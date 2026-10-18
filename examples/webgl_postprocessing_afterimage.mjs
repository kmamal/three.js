import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { AfterimagePass } from '@kmamal/three/addons/postprocessing/AfterimagePass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - postprocessing - afterimage', api: 'webgl' } );

let camera, scene, renderer, composer;
let mesh;

let afterimagePass;

const params = {

	enable: true

};

init();

function init() {

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 400;

	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x000000, 1, 1000 );

	const geometry = new THREE.BoxGeometry( 150, 150, 150, 2, 2, 2 );
	const material = new THREE.MeshNormalMaterial();
	mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	// postprocessing

	composer = new EffectComposer( renderer );
	composer.addPass( new RenderPass( scene, camera ) );

	afterimagePass = new AfterimagePass();
	composer.addPass( afterimagePass );

	const outputPass = new OutputPass();
	composer.addPass( outputPass );

	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI( { title: 'Damp setting' } );
	gui.add( afterimagePass, 'damp', 0, 1 ).step( 0.001 );
	gui.add( params, 'enable' );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	composer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	mesh.rotation.x += 0.005;
	mesh.rotation.y += 0.01;

	afterimagePass.enabled = params.enable;

	composer.render();

}
