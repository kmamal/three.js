import * as THREE from '@kmamal/three/webgpu';
import { pass, renderOutput } from '@kmamal/three/tsl';
import { sobel } from '@kmamal/three/addons/tsl/display/SobelOperatorNode.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - postprocessing sobel', api: 'webgpu' } );
let camera, scene, renderer, controls;
let renderPipeline;

const params = {
	enabled: true
};

init();

async function init() {

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 1, 3 );

	//

	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync( 'models/gltf/DragonAttenuation.glb' );
	const model = gltf.scene.children[ 1 ];
	model.material = new THREE.MeshStandardNodeMaterial();

	scene.add( model );

	//

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.LinearToneMapping;

	await renderer.init();

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.environment = pmremGenerator.fromScene( environment, 0.04 ).texture;
	pmremGenerator.dispose();

	//

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.enableZoom = false;
	controls.target.set( 0, 0.5, 0 );
	controls.update();

	// postprocessing

	renderPipeline = new THREE.RenderPipeline( renderer );
	renderPipeline.outputColorTransform = false;

	const scenePass = pass( scene, camera );

	renderPipeline.outputNode = sobel( renderOutput( scenePass ) );

	//

	const gui = new GUI( { title: 'Settings' } );
	gui.add( params, 'enabled' );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();

	if ( params.enabled === true ) {

		renderPipeline.render();

	} else {

		renderer.render( scene, camera );

	}

}
