import * as THREE from '@kmamal/three/webgpu';
import { mrt, output, pass, velocity } from '@kmamal/three/tsl';
import { taau } from '@kmamal/three/addons/tsl/display/TAAUNode.js';
import { sharpen } from '@kmamal/three/addons/tsl/display/SharpenNode.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { DRACOLoader } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - postprocessing taau', api: 'webgpu' } );

const params = {
	upscaleMethod: 'TAAU',
	resolutionScale: 0.5,
	sharpening: true,
	sharpness: 0.2,
};

let camera, scene, renderer, renderPipeline, controls, mixer, timer;

init();

async function init() {

	camera = new THREE.PerspectiveCamera( 25, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( - 0.5, 0, 12 );

	scene = new THREE.Scene();

	timer = new THREE.Timer();
	timer.connect( document );

	// model

	const dracoLoader = new DRACOLoader();
	const loader = new GLTFLoader();
	loader.setDRACOLoader( dracoLoader );

	loader.load( 'models/gltf/LittlestTokyo.glb', function ( gltf ) {

		const model = gltf.scene;
		model.scale.set( 0.01, 0.01, 0.01 );
		scene.add( model );

		mixer = new THREE.AnimationMixer( model );
		mixer.clipAction( gltf.animations[ 0 ] ).play();

	} );

	// renderer

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	await renderer.init();

	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xbfe3dd );
	scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

	// controls

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.target.set( - 0.5, 0, 0 );

	// render pipeline

	renderPipeline = new THREE.RenderPipeline( renderer );
	const scenePass = pass( scene, camera );
	scenePass.setResolutionScale( params.resolutionScale );
	scenePass.setMRT( mrt( {
		output: output,
		velocity: velocity
	} ) );

	const scenePassColor = scenePass.getTextureNode( 'output' );
	const scenePassDepth = scenePass.getTextureNode( 'depth' );
	const scenePassVelocity = scenePass.getTextureNode( 'velocity' );

	const taauNode = taau( scenePassColor, scenePassDepth, scenePassVelocity, camera );
	const sharpenNode = sharpen( taauNode.getTextureNode(), params.sharpness );

	function updatePipeline() {

		if ( params.upscaleMethod === 'TAAU' ) {

			renderPipeline.outputNode = params.sharpening ? sharpenNode : taauNode;

		} else {

			renderPipeline.outputNode = scenePass;

		}

		renderPipeline.needsUpdate = true;

	}

	// gui

	const gui = new GUI( { title: 'Settings' } );
	gui.add( params, 'upscaleMethod', [ 'Bilinear', 'TAAU' ] ).onChange( updatePipeline );
	gui.add( params, 'resolutionScale', 0.25, 1.0, 0.25 ).onChange( ( value ) => {

		scenePass.setResolutionScale( value );

	} );
	gui.add( params, 'sharpening' ).onChange( updatePipeline );
	gui.add( params, 'sharpness', 0, 2, 0.05 ).onChange( ( value ) => {

		sharpenNode.sharpness.value = value;

	} );

	updatePipeline();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

function animate() {

	controls.update();

	timer.update();

	const delta = timer.getDelta();

	if ( mixer ) {

		mixer.update( delta );

	}

	renderPipeline.render();

}
