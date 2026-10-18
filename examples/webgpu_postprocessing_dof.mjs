import * as THREE from '@kmamal/three/webgpu';
import { cubeTexture, positionWorld, oscSine, time, pass, uniform } from '@kmamal/three/tsl';
import { dof } from '@kmamal/three/addons/tsl/display/DepthOfFieldNode.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - postprocessing dof', api: 'webgpu' } );
//

let camera, scene, renderer, mesh, controls;

let width = window.innerWidth;
let height = window.innerHeight;

let renderPipeline;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 70, width / height, 1, 3500 );
	camera.position.z = 200;

	scene = new THREE.Scene();

	const path = 'textures/cube/SwedishRoyalCastle/';
	const format = '.jpg';
	const urls = [
		path + 'px' + format, path + 'nx' + format,
		path + 'py' + format, path + 'ny' + format,
		path + 'pz' + format, path + 'nz' + format
	];

	const xgrid = 14, ygrid = 9, zgrid = 14;
	const count = xgrid * ygrid * zgrid;

	const textureCube = new THREE.CubeTextureLoader().load( urls );
	const cubeTextureNode = cubeTexture( textureCube );
	const oscPos = oscSine( positionWorld.div( 1000 /* scene distance */ ).add( time.mul( .2 ) ) );

	const geometry = new THREE.SphereGeometry( 60, 20, 10 );
	const material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = cubeTextureNode.mul( oscPos );

	mesh = new THREE.InstancedMesh( geometry, material, count );
	scene.add( mesh );

	const matrix = new THREE.Matrix4();

	let index = 0;

	for ( let i = 0; i < xgrid; i ++ ) {

		for ( let j = 0; j < ygrid; j ++ ) {

			for ( let k = 0; k < zgrid; k ++ ) {

				const x = 200 * ( i - xgrid / 2 );
				const y = 200 * ( j - ygrid / 2 );
				const z = 200 * ( k - zgrid / 2 );

				mesh.setMatrixAt( index, matrix.identity().setPosition( x, y, z ) );
				index ++;

			}

		}

	}

	// renderer

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	const effectController = {
		focusDistance: uniform( 500 ),
		focalLength: uniform( 200 ),
		bokehScale: uniform( 10 )
	};

	// post processing

	renderPipeline = new THREE.RenderPipeline( renderer );

	const scenePass = pass( scene, camera );

	const scenePassColor = scenePass.getTextureNode();
	const scenePassViewZ = scenePass.getViewZNode();

	const dofPass = dof( scenePassColor, scenePassViewZ, effectController.focusDistance, effectController.focalLength, effectController.bokehScale );

	renderPipeline.outputNode = dofPass;

	// controls

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;

	window.addEventListener( 'resize', onWindowResize );

	// gui

	const gui = new GUI( { title: 'Settings' } );
	gui.add( effectController.focusDistance, 'value', 10.0, 3000.0 ).name( 'focus distance' );
	gui.add( effectController.focalLength, 'value', 50, 750 ).name( 'focal length' );
	gui.add( effectController.bokehScale, 'value', 1, 20 ).name( 'bokeh scale' );

}

function onWindowResize() {

	width = window.innerWidth;
	height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

function animate() {

	controls.update();

	renderPipeline.render();

}
