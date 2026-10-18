import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { VRMLLoader } from '@kmamal/three/addons/loaders/VRMLLoader.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - loaders - VRML loader', api: 'webgl' } );

let camera, scene, renderer, stats, controls, loader;

const params = {
	asset: 'house'
};

const assets = [
	'creaseAngle',
	'crystal',
	'house',
	'elevationGrid1',
	'elevationGrid2',
	'extrusion1',
	'extrusion2',
	'extrusion3',
	'lines',
	'linesTransparent',
	'meshWithLines',
	'meshWithTexture',
	'pixelTexture',
	'points',
	'camera',
	'multilineString'
];

let vrmlScene;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1e10 );
	camera.position.set( - 10, 5, 10 );

	scene = new THREE.Scene();
	scene.add( camera );

	// light

	const ambientLight = new THREE.AmbientLight( 0xffffff, 1.2 );
	scene.add( ambientLight );

	const dirLight = new THREE.DirectionalLight( 0xffffff, 2.0 );
	dirLight.position.set( 200, 200, 200 );
	scene.add( dirLight );

	loader = new VRMLLoader();
	loadAsset( params.asset );

	// renderer

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	// controls

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 200;
	controls.enableDamping = true;

	//

	stats = new Stats();

	//

	window.addEventListener( 'resize', onWindowResize );

	//

	const gui = new GUI();
	gui.add( params, 'asset', assets ).onChange( function ( value ) {

		if ( vrmlScene ) {

			vrmlScene.traverse( function ( object ) {

				if ( object.material ) object.material.dispose();
				if ( object.material && object.material.map ) object.material.map.dispose();
				if ( object.geometry ) object.geometry.dispose();

			} );

			scene.remove( vrmlScene );

		}

		loadAsset( value );

	} );

}

function loadAsset( asset ) {

	loader.load( 'models/vrml/' + asset + '.wrl', function ( object ) {

		vrmlScene = object;
		scene.add( object );
		controls.reset();

	} );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update(); // to support damping

	renderer.render( scene, camera );

	stats.update();

}
