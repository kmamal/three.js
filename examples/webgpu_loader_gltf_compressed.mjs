import * as THREE from '@kmamal/three/webgpu';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from '@kmamal/three/addons/libs/meshopt_decoder.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - glTF + compressed', api: 'webgpu' } );

let camera, scene, renderer;

init();

async function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 1, 20 );
	camera.position.set( 2, 2, 2 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xEEEEEE );

	//lights

	const light = new THREE.PointLight( 0xffffff );
	light.power = 1300;
	camera.add( light );
	scene.add( camera );

	//renderer

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMappingExposure = 1;

	await renderer.init();

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 3;
	controls.maxDistance = 6;
	controls.update();

	const ktx2Loader = await new KTX2Loader()
		.detectSupport( renderer );

	const loader = new GLTFLoader();
	loader.setKTX2Loader( ktx2Loader );
	loader.setMeshoptDecoder( MeshoptDecoder );
	loader.load( 'models/gltf/coffeemat.glb', function ( gltf ) {

		const gltfScene = gltf.scene;
		gltfScene.position.y = - .8;
		gltfScene.scale.setScalar( .01 );

		scene.add( gltfScene );

	} );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	renderer.render( scene, camera );

}
