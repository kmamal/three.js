import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { HDRCubeTextureLoader } from '@kmamal/three/addons/loaders/HDRCubeTextureLoader.js';
import { DebugEnvironment } from '@kmamal/three/addons/environments/DebugEnvironment.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'threejs webgl - materials - hdr environment mapping', api: 'webgl' } );

const params = {
	envMap: 'HDR',
	roughness: 0.0,
	metalness: 0.0,
	exposure: 1.0,
	debug: false
};

let stats;
let camera, scene, renderer, controls;
let torusMesh, planeMesh;
let generatedCubeRenderTarget, ldrCubeRenderTarget, hdrCubeRenderTarget;
let ldrCubeMap, hdrCubeMap;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.set( 0, 0, 120 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	//

	let geometry = new THREE.TorusKnotGeometry( 18, 8, 150, 20 );
	// let geometry = new THREE.SphereGeometry( 26, 64, 32 );
	let material = new THREE.MeshStandardMaterial( {
		color: 0xffffff,
		metalness: params.metalness,
		roughness: params.roughness
	} );

	torusMesh = new THREE.Mesh( geometry, material );
	scene.add( torusMesh );

	geometry = new THREE.PlaneGeometry( 200, 200 );
	material = new THREE.MeshBasicMaterial();

	planeMesh = new THREE.Mesh( geometry, material );
	planeMesh.position.y = - 50;
	planeMesh.rotation.x = - Math.PI * 0.5;
	scene.add( planeMesh );

	THREE.DefaultLoadingManager.onLoad = function ( ) {

		pmremGenerator.dispose();

	};

	const hdrUrls = [ 'px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr' ];
	hdrCubeMap = new HDRCubeTextureLoader()
		.setPath( './textures/cube/pisaHDR/' )
		.load( hdrUrls, function () {

			hdrCubeRenderTarget = pmremGenerator.fromCubemap( hdrCubeMap );

			hdrCubeMap.magFilter = THREE.LinearFilter;
			hdrCubeMap.needsUpdate = true;

		} );

	const ldrUrls = [ 'px.png', 'nx.png', 'py.png', 'ny.png', 'pz.png', 'nz.png' ];
	ldrCubeMap = new THREE.CubeTextureLoader()
		.setPath( './textures/cube/pisa/' )
		.load( ldrUrls, function () {

			ldrCubeRenderTarget = pmremGenerator.fromCubemap( ldrCubeMap );

		} );

	const pmremGenerator = new THREE.PMREMGenerator( renderer );
	pmremGenerator.compileCubemapShader();

	const envScene = new DebugEnvironment();
	generatedCubeRenderTarget = pmremGenerator.fromScene( envScene );

	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//renderer.toneMapping = ReinhardToneMapping;

	stats = new Stats();

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 50;
	controls.maxDistance = 300;

	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI();

	gui.add( params, 'envMap', [ 'Generated', 'LDR', 'HDR' ] );
	gui.add( params, 'roughness', 0, 1, 0.01 );
	gui.add( params, 'metalness', 0, 1, 0.01 );
	gui.add( params, 'exposure', 0, 2, 0.01 );
	gui.add( params, 'debug' );
	gui.open();

}

function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

function animate() {

	stats.begin();
	render();
	stats.end();

}

function render() {

	torusMesh.material.roughness = params.roughness;
	torusMesh.material.metalness = params.metalness;

	let renderTarget, cubeMap;

	switch ( params.envMap ) {

		case 'Generated':
			renderTarget = generatedCubeRenderTarget;
			cubeMap = generatedCubeRenderTarget.texture;
			break;
		case 'LDR':
			renderTarget = ldrCubeRenderTarget;
			cubeMap = ldrCubeMap;
			break;
		case 'HDR':
			renderTarget = hdrCubeRenderTarget;
			cubeMap = hdrCubeMap;
			break;

	}

	const newEnvMap = renderTarget ? renderTarget.texture : null;

	if ( newEnvMap && newEnvMap !== torusMesh.material.envMap ) {

		torusMesh.material.envMap = newEnvMap;
		torusMesh.material.needsUpdate = true;

		planeMesh.material.map = newEnvMap;
		planeMesh.material.needsUpdate = true;

	}

	torusMesh.rotation.y += 0.005;
	planeMesh.visible = params.debug;

	scene.background = cubeMap;
	renderer.toneMappingExposure = params.exposure;

	renderer.render( scene, camera );

}
