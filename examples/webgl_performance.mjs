import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - GLTFloader', api: 'webgl' } );

let camera, scene, renderer, stats;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 60, 60, 60 );

	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;

	renderer.setAnimationLoop( render );

	//

	stats = new Stats();

	new UltraHDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'royal_esplanade_2k.hdr.jpg', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.environment = texture;

			// model

			const loader = new GLTFLoader().setPath( 'models/gltf/' );
			loader.load( 'dungeon_warkarma.glb', async function ( gltf ) {

				const model = gltf.scene;

				// wait until the model can be added to the scene without blocking due to shader compilation

				await renderer.compileAsync( model, camera, scene );

				scene.add( model );

			} );

		} );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 2;
	controls.maxDistance = 60;
	controls.target.set( 0, 0, - 0.2 );
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

	stats.update();

}
