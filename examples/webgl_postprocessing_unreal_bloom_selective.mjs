import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from '@kmamal/three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '@kmamal/three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - postprocessing - unreal bloom selective', api: 'webgl' } );

const shaders = {
	vertexshader: `varying vec2 vUv;

void main() {

	vUv = uv;

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}`,
	fragmentshader: `uniform sampler2D baseTexture;
uniform sampler2D bloomTexture;
uniform float bloomStrength;

varying vec2 vUv;

void main() {

	gl_FragColor = ( texture2D( baseTexture, vUv ) + texture2D( bloomTexture, vUv ) * bloomStrength );

}`
};

const BLOOM_SCENE = 1;

const bloomLayer = new THREE.Layers();
bloomLayer.set( BLOOM_SCENE );

const params = {
	threshold: 0,
	strength: 1,
	radius: 0.5,
	exposure: 1
};

const darkMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
const materials = {};

const renderer = new THREE.WebGLRenderer( { antialias: false, window: sdlWindow } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.toneMapping = THREE.NeutralToneMapping;

const scene = new THREE.Scene();
const pmremGenerator = new THREE.PMREMGenerator( renderer );
scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 200 );
camera.position.set( 0, 0, 20 );
camera.lookAt( 0, 0, 0 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.maxPolarAngle = Math.PI * 0.5;
controls.minDistance = 1;
controls.maxDistance = 100;
controls.addEventListener( 'change', render );

const renderScene = new RenderPass( scene, camera );

const bloomPass = new UnrealBloomPass( new THREE.Vector2( window.innerWidth, window.innerHeight ), 1.5, 0.4, 0.85 );
bloomPass.threshold = params.threshold;
bloomPass.strength = params.strength;
bloomPass.radius = params.radius;

const bloomRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType } );
const bloomComposer = new EffectComposer( renderer, bloomRenderTarget );
bloomComposer.renderToScreen = false;
bloomComposer.addPass( renderScene );
bloomComposer.addPass( bloomPass );

const mixPass = new ShaderPass(
	new THREE.ShaderMaterial( {
		uniforms: {
			baseTexture: { value: null },
			bloomTexture: { value: bloomComposer.renderTarget2.texture },
			bloomStrength: { value: params.strength }
		},
		vertexShader: shaders.vertexshader,
		fragmentShader: shaders.fragmentshader,
		defines: {}
	} ), 'baseTexture'
);
mixPass.needsSwap = true;

const outputPass = new OutputPass();

const finalRenderTarget = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, { type: THREE.HalfFloatType, samples: 4 } );
const finalComposer = new EffectComposer( renderer, finalRenderTarget );
finalComposer.addPass( renderScene );
finalComposer.addPass( mixPass );
finalComposer.addPass( outputPass );

const raycaster = new THREE.Raycaster();

const mouse = new THREE.Vector2();

window.addEventListener( 'pointerdown', onPointerDown );

const gui = new GUI();

const bloomFolder = gui.addFolder( 'bloom' );

bloomFolder.add( params, 'threshold', 0.0, 1.0 ).onChange( function ( value ) {

	bloomPass.threshold = Number( value );
	render();

} );

bloomFolder.add( params, 'strength', 0.0, 3 ).onChange( function ( value ) {

	bloomPass.strength = Number( value );
	mixPass.material.uniforms.bloomStrength.value = bloomPass.strength;

	render();

} );

bloomFolder.add( params, 'radius', 0.0, 1.0 ).step( 0.01 ).onChange( function ( value ) {

	bloomPass.radius = Number( value );
	render();

} );

const toneMappingFolder = gui.addFolder( 'tone mapping' );

toneMappingFolder.add( params, 'exposure', 0.1, 2 ).onChange( function ( value ) {

	renderer.toneMappingExposure = Math.pow( value, 4.0 );
	render();

} );

setupScene();

function onPointerDown( event ) {

	mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

	raycaster.setFromCamera( mouse, camera );
	const intersects = raycaster.intersectObjects( scene.children, false );
	if ( intersects.length > 0 ) {

		const object = intersects[ 0 ].object;
		object.layers.toggle( BLOOM_SCENE );
		render();

	}

}

window.onresize = function () {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

	bloomComposer.setSize( width, height );
	finalComposer.setSize( width, height );

	render();

};

function setupScene() {

	scene.traverse( disposeMaterial );
	scene.children.length = 0;

	const geometry = new THREE.IcosahedronGeometry( 1, 15 );

	for ( let i = 0; i < 50; i ++ ) {

		const color = new THREE.Color();
		color.setHSL( Math.random(), 0.7, Math.random() * 0.2 + 0.05 );

		const material = new THREE.MeshStandardMaterial( { color: color, roughness: 1, metalness: 1 } );
		const sphere = new THREE.Mesh( geometry, material );
		sphere.position.x = Math.random() * 10 - 5;
		sphere.position.y = Math.random() * 10 - 5;
		sphere.position.z = Math.random() * 10 - 5;
		sphere.position.normalize().multiplyScalar( Math.random() * 4.0 + 2.0 );
		sphere.scale.setScalar( Math.random() * Math.random() + 0.5 );
		scene.add( sphere );

		if ( Math.random() < 0.25 ) sphere.layers.enable( BLOOM_SCENE );

	}

	render();

}

function disposeMaterial( obj ) {

	if ( obj.material ) {

		obj.material.dispose();

	}

}

function render() {

	scene.traverse( darkenNonBloomed );
	bloomComposer.render();
	scene.traverse( restoreMaterial );

	// render the entire scene, then render bloom scene on top
	finalComposer.render();

}

function darkenNonBloomed( obj ) {

	if ( obj.isMesh && bloomLayer.test( obj.layers ) === false ) {

		materials[ obj.uuid ] = obj.material;
		obj.material = darkMaterial;

	}

}

function restoreMaterial( obj ) {

	if ( materials[ obj.uuid ] ) {

		obj.material = materials[ obj.uuid ];
		delete materials[ obj.uuid ];

	}

}
