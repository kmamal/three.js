import * as THREE from '@kmamal/three/webgpu';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - tone mapping', api: 'webgpu' } );

let renderer, scene, camera, controls;
let gui;

const params = {
	exposure: 1.0,
	toneMapping: 'Neutral',
	blurriness: 0.3,
	intensity: 1.0,
};

const toneMappingOptions = {
	None: THREE.NoToneMapping,
	Linear: THREE.LinearToneMapping,
	Reinhard: THREE.ReinhardToneMapping,
	Cineon: THREE.CineonToneMapping,
	ACESFilmic: THREE.ACESFilmicToneMapping,
	AgX: THREE.AgXToneMapping,
	Neutral: THREE.NeutralToneMapping
};

init().catch( function ( err ) {

	console.error( err );

} );

async function init() {

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	renderer.toneMapping = toneMappingOptions[ params.toneMapping ];
	renderer.toneMappingExposure = params.exposure;

	scene = new THREE.Scene();
	scene.backgroundBlurriness = params.blurriness;

	const light = new THREE.DirectionalLight( 0xfff3ee, 3 ); // simulate sun
	light.position.set( 1, 0.05, 0.7 );
	scene.add( light );

	// scene.add( new THREE.DirectionalLightHelper( light, 1, 0x000000 ) );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 10 );
	camera.position.set( - 0.02, 0.03, 0.05 );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enablePan = false;
	controls.enableDamping = true;
	controls.minDistance = 0.03;
	controls.maxDistance = 0.2;
	controls.target.set( 0, 0.03, 0 );
	controls.update();

	const hdrLoader = new HDRLoader()
		.setPath( 'textures/equirectangular/' );

	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

	const gltfLoader = new GLTFLoader();
	gltfLoader.setDRACOLoader( dracoLoader );
	gltfLoader.setPath( 'models/gltf/' );

	const [ texture, gltf ] = await Promise.all( [
		hdrLoader.loadAsync( 'venice_sunset_1k.hdr' ),
		gltfLoader.loadAsync( 'venice_mask.glb' ),
	] );

	// environment

	texture.mapping = THREE.EquirectangularReflectionMapping;

	scene.background = texture;
	scene.environment = texture;

	// model

	scene.add( gltf.scene );

	window.addEventListener( 'resize', onWindowResize );

	//

	gui = new GUI( { title: 'Settings' } );
	const toneMappingFolder = gui.addFolder( 'Tone Mapping' );

	toneMappingFolder.add( params, 'toneMapping', Object.keys( toneMappingOptions ) )

		.name( 'type' )
		.onChange( function () {

			renderer.toneMapping = toneMappingOptions[ params.toneMapping ];

		} );

	toneMappingFolder.add( params, 'exposure', 0, 2 )

		.onChange( function ( value ) {

			renderer.toneMappingExposure = value;

		} );

	const backgroundFolder = gui.addFolder( 'Background' );

	backgroundFolder.add( params, 'blurriness', 0, 1 )

		.onChange( function ( value ) {

			scene.backgroundBlurriness = value;

		} );

	backgroundFolder.add( params, 'intensity', 0, 1 )

		.onChange( function ( value ) {

			scene.backgroundIntensity = value;

		} );

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
