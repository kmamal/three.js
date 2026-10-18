import * as THREE from '@kmamal/three/webgpu';

import { stereoPass } from '@kmamal/three/addons/tsl/display/StereoPassNode.js';
import { anaglyphPass, AnaglyphAlgorithm, AnaglyphColorMode } from '@kmamal/three/addons/tsl/display/AnaglyphPassNode.js';
import { parallaxBarrierPass } from '@kmamal/three/addons/tsl/display/ParallaxBarrierPassNode.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - stereo effects', api: 'webgpu' } );
let camera, scene, renderer, renderPipeline;

let stereo, anaglyph, parallaxBarrier;

let mesh, dummy, timer;

let anaglyphFolder;

const position = new THREE.Vector3();

const params = {
	effect: 'stereo',
	eyeSep: 0.064,
	planeDistance: 3,
	anaglyphAlgorithm: 'dubois',
	anaglyphColorMode: 'redCyan'
};

const effects = { Stereo: 'stereo', Anaglyph: 'anaglyph', ParallaxBarrier: 'parallaxBarrier' };

const anaglyphAlgorithms = {
	'True': AnaglyphAlgorithm.TRUE,
	'Grey': AnaglyphAlgorithm.GREY,
	'Colour': AnaglyphAlgorithm.COLOUR,
	'Half-Colour': AnaglyphAlgorithm.HALF_COLOUR,
	'Dubois': AnaglyphAlgorithm.DUBOIS,
	'Optimised': AnaglyphAlgorithm.OPTIMISED,
	'Compromise': AnaglyphAlgorithm.COMPROMISE
};

const anaglyphColorModes = {
	'Red / Cyan': AnaglyphColorMode.RED_CYAN,
	'Magenta / Cyan': AnaglyphColorMode.MAGENTA_CYAN,
	'Magenta / Green': AnaglyphColorMode.MAGENTA_GREEN
};

init();

function init() {

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 3;

	scene = new THREE.Scene();
	scene.background = new THREE.CubeTextureLoader()
		.setPath( 'textures/cube/Park3Med/' )
		.load( [ 'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg' ] );

	timer = new THREE.Timer();
	timer.connect( document );

	const geometry = new THREE.SphereGeometry( 0.1, 32, 16 );

	const textureCube = new THREE.CubeTextureLoader()
		.setPath( 'textures/cube/Park3Med/' )
		.load( [ 'px.jpg', 'nx.jpg', 'py.jpg', 'ny.jpg', 'pz.jpg', 'nz.jpg' ] );

	const material = new THREE.MeshBasicMaterial( { color: 0xffffff, envMap: textureCube } );

	mesh = new THREE.InstancedMesh( geometry, material, 500 );
	mesh.instanceMatrix.setUsage( THREE.DynamicDrawUsage );

	dummy = new THREE.Mesh();

	for ( let i = 0; i < 500; i ++ ) {

		dummy.position.x = Math.random() * 10 - 5;
		dummy.position.y = Math.random() * 10 - 5;
		dummy.position.z = Math.random() * 10 - 5;
		dummy.scale.x = dummy.scale.y = dummy.scale.z = Math.random() * 3 + 1;

		dummy.updateMatrix();

		mesh.setMatrixAt( i, dummy.matrix );

	}

	scene.add( mesh );

	//

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	renderPipeline = new THREE.RenderPipeline( renderer );
	stereo = stereoPass( scene, camera );
	anaglyph = anaglyphPass( scene, camera );
	parallaxBarrier = parallaxBarrierPass( scene, camera );

	// Configure anaglyph for physically-correct stereo with zero parallax at scene center
	anaglyph.eyeSep = params.eyeSep;
	anaglyph.planeDistance = params.planeDistance;

	renderPipeline.outputNode = stereo;

	const gui = new GUI( { title: 'Stereo Settings' } );
	gui.add( params, 'effect', effects ).onChange( update );
	gui.add( params, 'eyeSep', 0.001, 0.15, 0.001 ).onChange( function ( value ) {

		stereo.stereo.eyeSep = value;
		anaglyph.eyeSep = value; // Anaglyph has direct eyeSep property
		parallaxBarrier.stereo.eyeSep = value;

	} );

	// Anaglyph-specific settings folder
	anaglyphFolder = gui.addFolder( 'Anaglyph Options' );
	anaglyphFolder.add( params, 'anaglyphAlgorithm', anaglyphAlgorithms ).name( 'Algorithm' ).onChange( function ( value ) {

		anaglyph.algorithm = value;

	} );
	anaglyphFolder.add( params, 'anaglyphColorMode', anaglyphColorModes ).name( 'Color Mode' ).onChange( function ( value ) {

		anaglyph.colorMode = value;

	} );
	anaglyphFolder.add( params, 'planeDistance', 0.5, 10, 0.1 ).name( 'Plane Distance' ).onChange( function ( value ) {

		anaglyph.planeDistance = value;

	} );
	anaglyphFolder.close();

	window.addEventListener( 'resize', onWindowResize );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 25;

}

function update( value ) {

	if ( value === 'stereo' ) {

		renderPipeline.outputNode = stereo;
		anaglyphFolder.close();

	} else if ( value === 'anaglyph' ) {

		renderPipeline.outputNode = anaglyph;
		anaglyphFolder.open();

	} else if ( value === 'parallaxBarrier' ) {

		renderPipeline.outputNode = parallaxBarrier;
		anaglyphFolder.close();

	}

	renderPipeline.needsUpdate = true;

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function extractPosition( matrix, position ) {

	position.x = matrix.elements[ 12 ];
	position.y = matrix.elements[ 13 ];
	position.z = matrix.elements[ 14 ];

}

function animate() {

	timer.update();

	const elapsedTime = timer.getElapsed() * 0.1;

	for ( let i = 0; i < mesh.count; i ++ ) {

		mesh.getMatrixAt( i, dummy.matrix );

		extractPosition( dummy.matrix, position );

		position.x = 5 * Math.cos( elapsedTime + i );
		position.y = 5 * Math.sin( elapsedTime + i * 1.1 );

		dummy.matrix.setPosition( position );

		mesh.setMatrixAt( i, dummy.matrix );

		mesh.instanceMatrix.needsUpdate = true;

	}

	renderPipeline.render();

}
