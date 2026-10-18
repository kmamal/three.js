import * as THREE from '@kmamal/three/webgpu';
import { pass, renderOutput } from '@kmamal/three/tsl';
import { fxaa } from '@kmamal/three/addons/tsl/display/FXAANode.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - FXAA', api: 'webgpu' } );
const params = {
	enabled: true,
	animated: false
};

let camera, scene, renderer, timer, group;
let renderPipeline;

init();

async function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 200 );
	camera.position.z = 50;

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xffffff );

	timer = new THREE.Timer();
	timer.connect( document );

	//

	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x8d8d8d );
	hemiLight.position.set( 0, 1000, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
	dirLight.position.set( - 3000, 1000, - 1000 );
	scene.add( dirLight );

	//

	group = new THREE.Group();

	const geometry = new THREE.TetrahedronGeometry();
	const material = new THREE.MeshStandardMaterial( { color: 0xf73232, flatShading: true } );

	const mesh = new THREE.InstancedMesh( geometry, material, 100 );
	const dummy = new THREE.Object3D();

	for ( let i = 0; i < 100; i ++ ) {

		dummy.position.x = Math.random() * 50 - 25;
		dummy.position.y = Math.random() * 50 - 25;
		dummy.position.z = Math.random() * 50 - 25;

		dummy.scale.setScalar( Math.random() * 2 + 1 );

		dummy.rotation.x = Math.random() * Math.PI;
		dummy.rotation.y = Math.random() * Math.PI;
		dummy.rotation.z = Math.random() * Math.PI;

		dummy.updateMatrix();
		mesh.setMatrixAt( i, dummy.matrix );

	}

	group.add( mesh );
	scene.add( group );

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	// post processing

	renderPipeline = new THREE.RenderPipeline( renderer );

	// ignore default output color transform ( toneMapping and outputColorSpace )
	// use renderOutput() for control the sequence

	renderPipeline.outputColorTransform = false;

	// scene pass

	const scenePass = pass( scene, camera );
	const outputPass = renderOutput( scenePass );

	// FXAA must be computed in sRGB color space (so after tone mapping and color space conversion)

	const fxaaPass = fxaa( outputPass );
	renderPipeline.outputNode = fxaaPass;

	//

	window.addEventListener( 'resize', onWindowResize );

	//

	const gui = new GUI( { title: 'Settings' } );
	gui.add( params, 'enabled' ).onChange( ( value ) => {

		if ( value === true ) {

			renderPipeline.outputNode = fxaaPass;

		} else {

			renderPipeline.outputNode = outputPass;

		}

		renderPipeline.needsUpdate = true;

	} );
	gui.add( params, 'animated' );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {

	timer.update();

	const delta = timer.getDelta();

	if ( params.animated === true ) {

		group.rotation.y += delta * 0.1;

	}

	renderPipeline.render();

}
