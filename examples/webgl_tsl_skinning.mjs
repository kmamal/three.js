import * as THREE from '@kmamal/three/webgpu';
import { WebGLNodesHandler } from '@kmamal/three/addons/tsl/WebGLNodesHandler.js';
import { WebGLRenderer } from '@kmamal/three';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - skinning', api: 'webgl' } );

let camera, scene, renderer;

let mixer, timer;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.01, 100 );
	camera.position.set( 1, 2, 3 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x3355aa );
	camera.lookAt( 0, 1, 0 );

	timer = new THREE.Timer();
	timer.connect( document );

	//lights

	const light = new THREE.PointLight( 0xffffff, 1, 100 );
	light.power = 2500;
	camera.add( light );
	scene.add( camera );

	const ambient = new THREE.AmbientLight( 0x4466ff, 1 );
	scene.add( ambient );

	const loader = new GLTFLoader();
	loader.load( 'models/gltf/Michelle.glb', function ( gltf ) {

		const object = gltf.scene;
		mixer = new THREE.AnimationMixer( object );

		const action = mixer.clipAction( gltf.animations[ 0 ] );
		action.play();

		scene.add( object );

	} );

	//renderer

	renderer = new WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setNodesHandler( new WebGLNodesHandler() );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.LinearToneMapping;
	renderer.toneMappingExposure = 0.4;

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	timer.update();

	const delta = timer.getDelta();

	if ( mixer ) mixer.update( delta );

	renderer.render( scene, camera );

}
