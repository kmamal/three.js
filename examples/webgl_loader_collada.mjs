import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { ColladaLoader } from '@kmamal/three/addons/loaders/ColladaLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - collada', api: 'webgl' } );

let stats, timer;
let camera, scene, renderer, elf;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 2000 );
	camera.position.set( 8, 10, 8 );
	camera.lookAt( 0, 3, 0 );

	scene = new THREE.Scene();

	timer = new THREE.Timer();
	timer.connect( document );

	// loading manager

	const loadingManager = new THREE.LoadingManager( function () {

		scene.add( elf );

	} );

	// collada

	const loader = new ColladaLoader( loadingManager );
	loader.load( './models/collada/elf/elf.dae', function ( collada ) {

		elf = collada.scene;

	} );

	//

	const ambientLight = new THREE.AmbientLight( 0xffffff );
	scene.add( ambientLight );

	const directionalLight = new THREE.DirectionalLight( 0xffffff, 2.5 );
	directionalLight.position.set( 1, 1, 0 ).normalize();
	scene.add( directionalLight );

	//

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	stats = new Stats();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	timer.update();

	render();
	stats.update();

}

function render() {

	const delta = timer.getDelta();

	if ( elf !== undefined ) {

		elf.rotation.z += delta * 0.5;

	}

	renderer.render( scene, camera );

}
