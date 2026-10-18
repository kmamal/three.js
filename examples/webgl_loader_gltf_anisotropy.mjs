import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - GLTFloader + Anisotropy', api: 'webgl' } );

let renderer, scene, camera, controls;

init();

async function init() {

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1.35;

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.01, 10 );
	camera.position.set( - 0.35, - 0.2, 0.35 );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, - 0.08, 0.11 );
	controls.minDistance = 0.1;
	controls.maxDistance = 2;
	controls.addEventListener( 'change', render );
	controls.update();

	const hdrLoader = new UltraHDRLoader().setPath( 'textures/equirectangular/' );
	const gltfLoader = new GLTFLoader().setPath( 'models/gltf/' );

	const [ texture, gltf ] = await Promise.all( [
		hdrLoader.loadAsync( 'royal_esplanade_2k.hdr.jpg' ),
		gltfLoader.loadAsync( 'AnisotropyBarnLamp.glb' ),
	] );

	// environment

	texture.mapping = THREE.EquirectangularReflectionMapping;

	scene.background = texture;
	scene.backgroundBlurriness = 0.5;
	scene.environment = texture;

	// model

	scene.add( gltf.scene );

	render();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;

	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();

}

function render() {

	renderer.render( scene, camera );

}
