import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { ColladaLoader } from '@kmamal/three/addons/loaders/ColladaLoader.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - collada - skinning', api: 'webgl' } );

let stats, timer, controls;
let camera, scene, renderer, mixer;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 25, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.set( 15, 10, - 15 );

	scene = new THREE.Scene();

	timer = new THREE.Timer();
	timer.connect( document );

	// collada

	const loader = new ColladaLoader();
	loader.load( './models/collada/stormtrooper/stormtrooper.dae', function ( collada ) {

		const avatar = collada.scene;
		const animations = avatar.animations;

		mixer = new THREE.AnimationMixer( avatar );
		mixer.clipAction( animations[ 0 ] ).play();

		scene.add( avatar );

	} );

	//

	const gridHelper = new THREE.GridHelper( 10, 20, 0xc1c1c1, 0x8d8d8d );
	scene.add( gridHelper );

	//

	const ambientLight = new THREE.AmbientLight( 0xffffff, 0.6 );
	scene.add( ambientLight );

	const directionalLight = new THREE.DirectionalLight( 0xffffff, 3 );
	directionalLight.position.set( 1.5, 1, - 1.5 );
	scene.add( directionalLight );

	//

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	controls = new OrbitControls( camera, renderer.domElement );
	controls.screenSpacePanning = true;
	controls.minDistance = 5;
	controls.maxDistance = 40;
	controls.target.set( 0, 2, 0 );
	controls.update();

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

	if ( mixer !== undefined ) {

		mixer.update( delta );

	}

	renderer.render( scene, camera );

}
