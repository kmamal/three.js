import * as THREE from '@kmamal/three/webgpu';
import { texture, equirectUV } from '@kmamal/three/tsl';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - equirectangular', api: 'webgpu' } );
let camera, scene, renderer;
let controls;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( 1, 0, 0 );

	const equirectTexture = new THREE.TextureLoader().load( 'textures/2294472375_24a3b8ef46_o.jpg' );
	equirectTexture.colorSpace = THREE.SRGBColorSpace;

	scene = new THREE.Scene();
	scene.backgroundNode = texture( equirectTexture, equirectUV(), 0 );

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.autoRotate = true;
	controls.rotateSpeed = - 0.125; // negative, to track mouse pointer
	controls.autoRotateSpeed = 1.0;

	// GUI

	const gui = new GUI( { title: 'Settings' } );

	gui.add( scene, 'backgroundIntensity', 0, 1 ).name( 'background intensity' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();

	renderer.render( scene, camera );

}
