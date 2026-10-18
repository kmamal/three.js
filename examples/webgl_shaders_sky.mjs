import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { Sky } from '@kmamal/three/addons/objects/Sky.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - shaders - sky sun shader', api: 'webgl' } );

let camera, scene, renderer;

let sky, sun;

let sphere, cubeCamera;

init();

function initSky() {

	// Add Sky
	sky = new Sky();
	sky.scale.setScalar( 450000 );
	scene.add( sky );

	sun = new THREE.Vector3();

	/// GUI

	const effectController = {
		turbidity: 10,
		rayleigh: 3,
		mieCoefficient: 0.005,
		mieDirectionalG: 0.7,
		elevation: 65,
		azimuth: 0,
		exposure: 0.05,
		cloudCoverage: 0.4,
		cloudDensity: 0.4,
		cloudElevation: 0.5,
		showSunDisc: true
	};

	function guiChanged() {

		const uniforms = sky.material.uniforms;
		uniforms[ 'turbidity' ].value = effectController.turbidity;
		uniforms[ 'rayleigh' ].value = effectController.rayleigh;
		uniforms[ 'mieCoefficient' ].value = effectController.mieCoefficient;
		uniforms[ 'mieDirectionalG' ].value = effectController.mieDirectionalG;
		uniforms[ 'cloudCoverage' ].value = effectController.cloudCoverage;
		uniforms[ 'cloudDensity' ].value = effectController.cloudDensity;
		uniforms[ 'cloudElevation' ].value = effectController.cloudElevation;
		uniforms[ 'showSunDisc' ].value = effectController.showSunDisc;

		const phi = THREE.MathUtils.degToRad( 90 - effectController.elevation );
		const theta = THREE.MathUtils.degToRad( effectController.azimuth );

		sun.setFromSphericalCoords( 1, phi, theta );

		uniforms[ 'sunPosition' ].value.copy( sun );

		renderer.toneMappingExposure = effectController.exposure;

	}

	const gui = new GUI();

	gui.add( effectController, 'turbidity', 0.0, 20.0, 0.1 ).onChange( guiChanged );
	gui.add( effectController, 'rayleigh', 0.0, 4, 0.001 ).onChange( guiChanged );
	gui.add( effectController, 'mieCoefficient', 0.0, 0.1, 0.001 ).onChange( guiChanged );
	gui.add( effectController, 'mieDirectionalG', 0.0, 1, 0.001 ).onChange( guiChanged );
	gui.add( effectController, 'elevation', 0, 90, 0.1 ).onChange( guiChanged );
	gui.add( effectController, 'azimuth', - 180, 180, 0.1 ).onChange( guiChanged );
	gui.add( effectController, 'exposure', 0, 1, 0.0001 ).onChange( guiChanged );
	gui.add( effectController, 'showSunDisc' ).onChange( guiChanged );

	const folderClouds = gui.addFolder( 'Clouds' );
	folderClouds.add( effectController, 'cloudCoverage', 0, 1, 0.01 ).name( 'coverage' ).onChange( guiChanged );
	folderClouds.add( effectController, 'cloudDensity', 0, 1, 0.01 ).name( 'density' ).onChange( guiChanged );
	folderClouds.add( effectController, 'cloudElevation', 0, 1, 0.01 ).name( 'elevation' ).onChange( guiChanged );

	guiChanged();

}

function init() {

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 100, 2000000 );
	camera.position.set( 0, 100, 2000 );

	scene = new THREE.Scene();

	const cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 256, { type: THREE.HalfFloatType } );
	cubeCamera = new THREE.CubeCamera( 1, 1000, cubeRenderTarget );

	sphere = new THREE.Mesh(
		new THREE.SphereGeometry( 400, 64, 32 ),
		new THREE.MeshBasicMaterial( { envMap: cubeRenderTarget.texture } )
	);
	scene.add( sphere );

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.5;

	const controls = new OrbitControls( camera, renderer.domElement );
	//controls.maxPolarAngle = Math.PI / 2;
	controls.enableZoom = false;
	controls.enablePan = false;

	initSky();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	sky.material.uniforms[ 'time' ].value = performance.now() * 0.001;

	sphere.visible = false;
	cubeCamera.update( renderer, scene );
	sphere.visible = true;

	renderer.render( scene, camera );

}
