import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { USDZExporter } from '@kmamal/three/addons/exporters/USDZExporter.js';
import * as WebGLTextureUtils from '@kmamal/three/addons/utils/WebGLTextureUtils.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - USDZ exporter', api: 'webgl' } );

let camera, scene, renderer, mixer, timer, controls;

const params = {
	exportUSDZ: exportUSDZ
};

init();

function init() {

	timer = new THREE.Timer();

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( - 2.5, 1.6, 3.0 );

	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xf0f0f0 );
	scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

	const ktx2loader = new KTX2Loader().detectSupport( renderer );
	const dracoLoader = new DRACOLoader();
	const gltfLoader = new GLTFLoader();

	gltfLoader.setDRACOLoader( dracoLoader );
	gltfLoader.setKTX2Loader( ktx2loader );
	gltfLoader.setPath( 'models/gltf/' );
	gltfLoader.load( 'CarbonFrameBike.glb', async function ( gltf ) {

		scene.add( gltf.scene );

		if ( gltf.animations.length > 0 ) {

			mixer = new THREE.AnimationMixer( gltf.scene );
			const action = mixer.clipAction( gltf.animations[ 0 ] );
			action.setLoop( THREE.LoopRepeat, Infinity );
			action.play();

		}

		// USDZ

		const exporter = new USDZExporter();
		exporter.setTextureUtils( { decompress: ( texture, maxTextureSize ) => WebGLTextureUtils.decompress( texture, maxTextureSize, renderer ) } ); // for texture decompresssing
		const arraybuffer = await exporter.parseAsync( gltf.scene, { animations: gltf.animations } );
		const blob = new Blob( [ arraybuffer ], { type: 'application/octet-stream' } );

		const link = document.getElementById( 'link' );
		link.href = URL.createObjectURL( blob );

	} );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 2;
	controls.maxDistance = 10;
	controls.enableDamping = true;
	controls.target.set( 0, 0.7, 0 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

	const isIOS = /iPad|iPhone|iPod/.test( navigator.userAgent );

	if ( isIOS === false ) {

		const gui = new GUI();

		gui.add( params, 'exportUSDZ' ).name( 'Export USDZ' );
		gui.open();

	}

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function exportUSDZ() {

	const link = document.getElementById( 'link' );
	link.click();

}

//

function animate() {

	timer.update();

	const delta = timer.getDelta();

	if ( mixer ) mixer.update( delta );

	controls.update();

	renderer.render( scene, camera );

}
