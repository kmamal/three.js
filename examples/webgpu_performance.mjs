import * as THREE from '@kmamal/three/webgpu';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';

import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - performance', api: 'webgpu' } );

let camera, scene, renderer;
let model;

const options = { static: true };

init();

function setStatic( object, value ) {

	object.traverse( child => {

		if ( child.isMesh ) {

			child.static = value;

		}

	} );

}

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 60, 60, 60 );

	scene = new THREE.Scene();

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;
	renderer.setAnimationLoop( render );

	//

	new UltraHDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'royal_esplanade_2k.hdr.jpg', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.environment = texture;

			// model

			const dracoLoader = new DRACOLoader();
			dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

			const loader = new GLTFLoader().setPath( 'models/gltf/' );
			loader.setDRACOLoader( dracoLoader );

			loader.load( 'dungeon_warkarma.glb', async function ( gltf ) {

				model = gltf.scene;

				// wait until the model can be added to the scene without blocking due to shader compilation

				await renderer.compileAsync( model, camera, scene );

				scene.add( model );

				//

				setStatic( model, options.static );

			} );

		} );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 2;
	controls.maxDistance = 60;
	controls.target.set( 0, 0, - 0.2 );
	controls.update();

	// gui

	const gui = new GUI( { title: 'Settings' } );
	gui.add( options, 'static' ).onChange( () => {

		setStatic( model, options.static );

	} );

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
