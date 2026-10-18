import * as THREE from '@kmamal/three';

import { TrackballControls } from '@kmamal/three/addons/controls/TrackballControls.js';
import { TDSLoader } from '@kmamal/three/addons/loaders/TDSLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - loaders - 3DS loader', api: 'webgl' } );

let controls;
let camera, scene, renderer;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 10 );
	camera.position.z = 2;

	scene = new THREE.Scene();
	scene.add( new THREE.AmbientLight( 0xffffff, 3 ) );

	const directionalLight = new THREE.DirectionalLight( 0xffeedd, 3 );
	directionalLight.position.set( 0, 0, 2 );
	scene.add( directionalLight );

	//3ds files dont store normal maps
	const normal = new THREE.TextureLoader().load( 'models/3ds/portalgun/textures/normal.jpg' );

	const loader = new TDSLoader( );
	loader.setResourcePath( 'models/3ds/portalgun/textures/' );
	loader.load( 'models/3ds/portalgun/portalgun.3ds', function ( object ) {

		object.traverse( function ( child ) {

			if ( child.isMesh ) {

				child.material.specular.setScalar( 0.1 );
				child.material.normalMap = normal;

			}

		} );

		scene.add( object );

	} );

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	controls = new TrackballControls( camera, renderer.domElement );

	window.addEventListener( 'resize', resize );

}

function resize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();
	renderer.render( scene, camera );

}
