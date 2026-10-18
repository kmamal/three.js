import * as THREE from '@kmamal/three';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - loader - ImageBitmap', api: 'webgl' } );

let camera, scene, renderer;
let group, cubes;

init();

function addImageBitmap() {

	new THREE.ImageBitmapLoader()
		.setOptions( { imageOrientation: 'flipY' } )
		.load( 'textures/planets/earth_atmos_2048.jpg?' + performance.now(), function ( imageBitmap ) {

			const texture = new THREE.CanvasTexture( imageBitmap );
			texture.colorSpace = THREE.SRGBColorSpace;
			const material = new THREE.MeshBasicMaterial( { map: texture } );

			// ImageBitmap should be disposed when done with it.

			texture.onUpdate = disposeImageBitmap;

			addCube( material );

		}, function ( p ) {

			console.log( p );

		}, function ( e ) {

			console.log( e );

		} );

}

function addImage() {

	new THREE.ImageLoader()
		.setCrossOrigin( '*' )
		.load( 'textures/planets/earth_atmos_2048.jpg?' + performance.now(), function ( image ) {

			const texture = new THREE.CanvasTexture( image );
			texture.colorSpace = THREE.SRGBColorSpace;
			const material = new THREE.MeshBasicMaterial( { color: 0xff8888, map: texture } );
			addCube( material );

		} );

}

const geometry = new THREE.BoxGeometry();

function addCube( material ) {

	const cube = new THREE.Mesh( geometry, material );
	cube.position.set( Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1 );
	cube.rotation.set( Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI, Math.random() * 2 * Math.PI );
	cubes.add( cube );

}

function init() {

	// CAMERA

	camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 1500 );
	camera.position.set( 0, 4, 7 );
	camera.lookAt( 0, 0, 0 );

	// SCENE

	scene = new THREE.Scene();

	//

	group = new THREE.Group();
	scene.add( group );

	group.add( new THREE.GridHelper( 4, 12, 0x888888, 0x444444 ) );

	cubes = new THREE.Group();
	group.add( cubes );

	// RENDERER

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	// TESTS

	setTimeout( addImage, 300 );
	setTimeout( addImage, 600 );
	setTimeout( addImage, 900 );
	setTimeout( addImageBitmap, 1300 );
	setTimeout( addImageBitmap, 1600 );
	setTimeout( addImageBitmap, 1900 );

	// EVENTS

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	group.rotation.y = performance.now() / 3000;

	renderer.render( scene, camera );

}

function disposeImageBitmap( texture ) {

	texture.source.data.close();
	texture.onUpdate = null; // make sure this callback is executed only once per texture

}
