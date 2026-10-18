import * as THREE from '@kmamal/three';

import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { FXAAPass } from '@kmamal/three/addons/postprocessing/FXAAPass.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js WebGL  - postprocessing - FXAA', api: 'webgl' } );

let camera, scene, renderer, controls;

let composer1, composer2, fxaaPass;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.z = 500;

	scene = new THREE.Scene();

	//

	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x8d8d8d );
	hemiLight.position.set( 0, 1000, 0 );
	scene.add( hemiLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 3 );
	dirLight.position.set( - 3000, 1000, - 1000 );
	scene.add( dirLight );

	//

	const geometry = new THREE.TetrahedronGeometry( 10 );
	const material = new THREE.MeshStandardMaterial( { color: 0xf73232, flatShading: true } );

	const mesh = new THREE.InstancedMesh( geometry, material, 100 );
	const dummy = new THREE.Object3D();

	for ( let i = 0; i < 100; i ++ ) {

		dummy.position.x = Math.random() * 500 - 250;
		dummy.position.y = Math.random() * 500 - 250;
		dummy.position.z = Math.random() * 500 - 250;

		dummy.scale.setScalar( Math.random() * 2 + 1 );

		dummy.rotation.x = Math.random() * Math.PI;
		dummy.rotation.y = Math.random() * Math.PI;
		dummy.rotation.z = Math.random() * Math.PI;

		dummy.updateMatrix();
		mesh.setMatrixAt( i, dummy.matrix );

	}

	scene.add( mesh );

	//

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.autoClear = false;
	controls = new OrbitControls( camera, renderer.domElement );
	controls.autoRotate = true;

	//

	const renderPass = new RenderPass( scene, camera );
	renderPass.clearAlpha = 0;

	//

	fxaaPass = new FXAAPass();

	const outputPass = new OutputPass();

	composer1 = new EffectComposer( renderer );
	composer1.addPass( renderPass );
	composer1.addPass( outputPass );

	//

	composer2 = new EffectComposer( renderer );
	composer2.addPass( renderPass );
	composer2.addPass( outputPass );

	// FXAA is engineered to be applied towards the end of engine post processing after conversion to low dynamic range and conversion to the sRGB color space for display.

	composer2.addPass( fxaaPass );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	composer1.setSize( window.innerWidth, window.innerHeight );
	composer2.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	const halfWidth = window.innerWidth / 2;

	controls.update();

	renderer.setScissorTest( true );

	renderer.setScissor( 0, 0, halfWidth - 1, window.innerHeight );
	composer1.render();

	renderer.setScissor( halfWidth, 0, halfWidth, window.innerHeight );
	composer2.render();

	renderer.setScissorTest( false );

}
