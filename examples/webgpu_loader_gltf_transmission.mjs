import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';

import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - glTF + transmission', api: 'webgpu' } );

let camera, scene, renderer, controls, timer, mixer;

init();

function init() {

	timer = new THREE.Timer();
	timer.connect( document );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( 0, 0.4, 0.7 );

	scene = new THREE.Scene();

	new UltraHDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'royal_esplanade_2k.hdr.jpg', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.background = texture;
			scene.backgroundBlurriness = 0.35;

			scene.environment = texture;

			// model

			new GLTFLoader()
				.setPath( 'models/gltf/' )
				.setDRACOLoader( new DRACOLoader().setDecoderPath( DRACO_GLTF_CONFIG ) )
				.load( 'IridescentDishWithOlives.glb', function ( gltf ) {

					mixer = new THREE.AnimationMixer( gltf.scene );
					mixer.clipAction( gltf.animations[ 0 ] ).play();

					scene.add( gltf.scene );

				} );

		} );

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setAnimationLoop( render );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;

	controls = new OrbitControls( camera, renderer.domElement );
	controls.autoRotate = true;
	controls.autoRotateSpeed = - 0.75;
	controls.enableDamping = true;
	controls.minDistance = 0.5;
	controls.maxDistance = 1;
	controls.target.set( 0, 0.1, 0 );
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

	timer.update();

	if ( mixer ) mixer.update( timer.getDelta() );

	controls.update();

	renderer.render( scene, camera );

}
