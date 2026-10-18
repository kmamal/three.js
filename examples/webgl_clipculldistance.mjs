import * as THREE from '@kmamal/three';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js WebGL 2 - clip cull distance', api: 'webgl' } );

const shaders = {
	vertexShader: `uniform float time;

varying vec4 vColor;

void main() {

	vColor = color;

	#ifdef USE_CLIP_DISTANCE
		vec4 worldPosition = modelMatrix * vec4( position, 1.0 );
		gl_ClipDistance[ 0 ] = worldPosition.x - sin( time ) * ( 0.5 );
	#endif

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

}`,
	fragmentShader: `varying vec4 vColor;

void main() {

	gl_FragColor = vColor;

}`
};

let camera, controls, timer, scene, renderer, stats;

let material;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 10 );
	camera.position.z = 2;

	scene = new THREE.Scene();

	timer = new THREE.Timer();
	timer.connect( document );

	//

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	if ( renderer.extensions.has( 'WEBGL_clip_cull_distance' ) === false ) {

		document.getElementById( 'notSupported' ).style.display = '';
		return;

	}

	const ext = renderer
		.getContext()
		.getExtension( 'WEBGL_clip_cull_distance' );
	const gl = renderer.getContext();

	gl.enable( ext.CLIP_DISTANCE0_WEBGL );

	// geometry

	const vertexCount = 200 * 3;

	const geometry = new THREE.BufferGeometry();

	const positions = [];
	const colors = [];

	for ( let i = 0; i < vertexCount; i ++ ) {

		// adding x,y,z
		positions.push( Math.random() - 0.5 );
		positions.push( Math.random() - 0.5 );
		positions.push( Math.random() - 0.5 );

		// adding r,g,b,a
		colors.push( Math.random() * 255 );
		colors.push( Math.random() * 255 );
		colors.push( Math.random() * 255 );
		colors.push( Math.random() * 255 );

	}

	const positionAttribute = new THREE.Float32BufferAttribute( positions, 3 );
	const colorAttribute = new THREE.Uint8BufferAttribute( colors, 4 );
	colorAttribute.normalized = true;

	geometry.setAttribute( 'position', positionAttribute );
	geometry.setAttribute( 'color', colorAttribute );

	// material

	material = new THREE.ShaderMaterial( {

		uniforms: {
			time: { value: 1.0 }
		},
		vertexShader: shaders.vertexShader,
		fragmentShader: shaders.fragmentShader,
		side: THREE.DoubleSide,
		transparent: true,
		vertexColors: true

	} );

	material.extensions.clipCullDistance = true;

	const mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	//

	controls = new OrbitControls( camera, renderer.domElement );

	//

	stats = new Stats();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	timer.update();

	controls.update();
	stats.update();

	material.uniforms.time.value = timer.getElapsed();

	renderer.render( scene, camera );

}
