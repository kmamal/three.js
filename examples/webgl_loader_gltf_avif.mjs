import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - GLTFloader + EXT_texture_avif', api: 'webgl' } );

let camera, scene, renderer;

init();
render();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 1.5, 4, 9 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xf6eedc );

	//

	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

	const loader = new GLTFLoader();
	loader.setDRACOLoader( dracoLoader );
	loader.setPath( 'models/gltf/AVIFTest/' );
	loader.load( 'forest_house.glb', function ( gltf ) {

		scene.add( gltf.scene );

		render();

	} );

	//

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'change', render );
	controls.target.set( 0, 2, 0 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();

}

//

function render() {

	renderer.render( scene, camera );

}
