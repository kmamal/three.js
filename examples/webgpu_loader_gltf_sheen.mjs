import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - sheen', api: 'webgpu' } );
let camera, scene, renderer, controls;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 20 );
	camera.position.set( - 0.75, 0.7, 1.25 );

	scene = new THREE.Scene();
	//scene.add( new THREE.DirectionalLight( 0xffffff, 2 ) );

	// model

	new GLTFLoader()
		.setPath( 'models/gltf/' )
		.load( 'SheenChair.glb', function ( gltf ) {

			scene.add( gltf.scene );

			const object = gltf.scene.getObjectByName( 'SheenChair_fabric' );

			const gui = new GUI( { title: 'SheenChair_fabric' } );

			gui.add( object.material, 'sheen', 0, 1 );

		} );

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;

	scene.background = new THREE.Color( 0xAAAAAA );

	new UltraHDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'royal_esplanade_2k.hdr.jpg', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.background = texture;
			//scene.backgroundBlurriness = 1; // @TODO: Needs PMREM
			scene.environment = texture;

		} );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.minDistance = 1;
	controls.maxDistance = 10;
	controls.target.set( 0, 0.35, 0 );
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

	controls.update(); // required if damping enabled

	render();

}

function render() {

	renderer.render( scene, camera );

}
