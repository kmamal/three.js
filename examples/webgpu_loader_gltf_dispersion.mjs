import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - glTF + dispersion', api: 'webgpu' } );

let camera, scene, renderer;

init();

async function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 5 );
	camera.position.set( 0.1, 0.05, 0.15 );

	scene = new THREE.Scene();

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( render );
	renderer.toneMapping = THREE.ReinhardToneMapping; // TODO: Add THREE.NeutralToneMapping;
	renderer.toneMappingExposure = 1;

	const hdrTexture = await new HDRLoader().setPath( 'textures/equirectangular/' ).loadAsync( 'pedestrian_overpass_1k.hdr' );
	hdrTexture.mapping = THREE.EquirectangularReflectionMapping;

	scene = new THREE.Scene();
	scene.backgroundBlurriness = 0.5;
	scene.environment = hdrTexture;
	scene.background = hdrTexture;

	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync( 'models/gltf/DispersionTest.glb' );

	scene.add( gltf.scene );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 0.1;
	controls.maxDistance = 10;
	controls.target.set( 0, 0, 0 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function render() {

	renderer.render( scene, camera );

}
