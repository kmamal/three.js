import * as THREE from '@kmamal/three/webgpu';
import { color } from '@kmamal/three/tsl';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import WebGPU from '@kmamal/three/addons/capabilities/WebGPU.js';
import { createWindow, createCanvas, viewOf } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = Array.from( { length: 40 }, ( _, i ) => createWindow( { title: 'three.js webgpu - multiple canvas - scene ' + ( i + 1 ), api: 'webgpu', width: 200, height: 200, resizable: false } ) );

//

if ( WebGPU.isAvailable() === false ) {

	throw new Error( 'No WebGPU support' );

}

//

let renderer;

const scenes = [];

init();

function init() {

	const geometries = [
		new THREE.BoxGeometry( 1, 1, 1 ),
		new THREE.SphereGeometry( 0.5, 12, 8 ),
		new THREE.DodecahedronGeometry( 0.5 ),
		new THREE.CylinderGeometry( 0.5, 0.5, 1, 12 )
	];

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindows[ 0 ] } );
	renderer.setClearColor( 0xffffff, 1 );
	renderer.setPixelRatio( viewOf( sdlWindows[ 0 ] ).window.devicePixelRatio );

	for ( let i = 0; i < 40; i ++ ) {

		const scene = new THREE.Scene();
		scene.backgroundNode = color( 0xeeeeee );

		const canvasTarget = i === 0 ? renderer.getCanvasTarget() : new THREE.CanvasTarget( createCanvas( sdlWindows[ i ] ) );
		canvasTarget.setPixelRatio( viewOf( sdlWindows[ i ] ).window.devicePixelRatio );

		// the window that represents the area we want to render the scene
		scene.userData.canvasTarget = canvasTarget;

		const camera = new THREE.PerspectiveCamera( 50, 1, 1, 10 );
		camera.position.z = 2;
		scene.userData.camera = camera;

		const controls = new OrbitControls( scene.userData.camera, scene.userData.canvasTarget.domElement );
		controls.minDistance = 2;
		controls.maxDistance = 5;
		controls.enablePan = false;
		controls.enableZoom = false;
		scene.userData.controls = controls;

		// add one random mesh to each scene
		const geometry = geometries[ geometries.length * Math.random() | 0 ];

		const material = new THREE.MeshStandardMaterial( {

			color: new THREE.Color().setHSL( Math.random(), 1, 0.75, THREE.SRGBColorSpace ),
			roughness: 0.5,
			metalness: 0,
			flatShading: true

		} );

		scene.add( new THREE.Mesh( geometry, material ) );

		scene.add( new THREE.HemisphereLight( 0xaaaaaa, 0x444444, 3 ) );

		const light = new THREE.DirectionalLight( 0xffffff, 1.5 );
		light.position.set( 1, 1, 1 );
		scene.add( light );

		scenes.push( scene );

	}

	renderer.setAnimationLoop( animate );

}

function animate() {

	scenes.forEach( function ( scene ) {

		// so something moves
		//scene.children[ 0 ].rotation.y = Date.now() * 0.001;

		// get the canvas and camera for this scene
		const { canvasTarget, camera } = scene.userData;

		//camera.aspect = width / height; // not changing in this example
		//camera.updateProjectionMatrix();

		//scene.userData.controls.update();

		renderer.setCanvasTarget( canvasTarget );
		renderer.render( scene, camera );

	} );

}
