import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { LightProbeHelper } from '@kmamal/three/addons/helpers/LightProbeHelperGPU.js';
import { LightProbeGenerator } from '@kmamal/three/addons/lights/LightProbeGenerator.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - light probe from cube camera', api: 'webgpu' } );

let renderer, scene, camera, cubeCamera;

let lightProbe;

init();

function init() {

	// renderer
	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	// scene
	scene = new THREE.Scene();

	// camera
	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.set( 0, 0, 30 );

	const cubeRenderTarget = new THREE.CubeRenderTarget( 256 );

	cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );

	// controls
	const controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'change', render );
	controls.minDistance = 10;
	controls.maxDistance = 50;
	controls.enablePan = false;

	// probe
	lightProbe = new THREE.LightProbe();
	scene.add( lightProbe );

	// envmap
	const genCubeUrls = function ( prefix, postfix ) {

		return [
			prefix + 'px' + postfix, prefix + 'nx' + postfix,
			prefix + 'py' + postfix, prefix + 'ny' + postfix,
			prefix + 'pz' + postfix, prefix + 'nz' + postfix
		];

	};

	const urls = genCubeUrls( 'textures/cube/pisa/', '.png' );

	new THREE.CubeTextureLoader().load( urls, async function ( cubeTexture ) {

		scene.background = cubeTexture;

		await renderer.init();

		cubeCamera.update( renderer, scene );

		const probe = await LightProbeGenerator.fromCubeRenderTarget( renderer, cubeRenderTarget );

		lightProbe.copy( probe );

		scene.add( new LightProbeHelper( lightProbe, 5 ) );

		render();

	} );

	// listener
	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	renderer.setSize( window.innerWidth, window.innerHeight );

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	render();

}

function render() {

	renderer.render( scene, camera );

}
