import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { FBXLoader } from '@kmamal/three/addons/loaders/FBXLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - FBX loader - Nurbs', api: 'webgl' } );

let camera, scene, renderer, stats;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.set( 2, 18, 28 );

	scene = new THREE.Scene();

	// grid
	const gridHelper = new THREE.GridHelper( 28, 28, 0x303030, 0x303030 );
	scene.add( gridHelper );

	// stats
	stats = new Stats();

	// model
	const loader = new FBXLoader();
	loader.load( 'models/fbx/nurbs.fbx', function ( object ) {

		scene.add( object );

	} );

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 12, 0 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {

	renderer.render( scene, camera );

	stats.update();

}
