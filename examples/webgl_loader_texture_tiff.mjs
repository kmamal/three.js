import * as THREE from '@kmamal/three';

import { TIFFLoader } from '@kmamal/three/addons/loaders/TIFFLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - materials - TIFF texture', api: 'webgl' } );

let renderer, scene, camera;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.01, 10 );
	camera.position.set( 0, 0, 4 );

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	scene = new THREE.Scene();

	const loader = new TIFFLoader();

	const geometry = new THREE.PlaneGeometry();

	// uncompressed

	loader.load( 'textures/tiff/crate_uncompressed.tif', function ( texture ) {

		texture.colorSpace = THREE.SRGBColorSpace;

		const material = new THREE.MeshBasicMaterial( { map: texture } );

		const mesh = new THREE.Mesh( geometry, material );
		mesh.position.set( - 1.5, 0, 0 );

		scene.add( mesh );

		render();

	} );

	// LZW

	loader.load( 'textures/tiff/crate_lzw.tif', function ( texture ) {

		texture.colorSpace = THREE.SRGBColorSpace;

		const material = new THREE.MeshBasicMaterial( { map: texture } );

		const mesh = new THREE.Mesh( geometry, material );
		mesh.position.set( 0, 0, 0 );

		scene.add( mesh );

		render();

	} );

	// JPEG

	loader.load( 'textures/tiff/crate_jpeg.tif', function ( texture ) {

		texture.colorSpace = THREE.SRGBColorSpace;

		const material = new THREE.MeshBasicMaterial( { map: texture } );

		const mesh = new THREE.Mesh( geometry, material );
		mesh.position.set( 1.5, 0, 0 );

		scene.add( mesh );

		render();

	} );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();

}

//

function render() {

	renderer.render( scene, camera );

}
