import * as THREE from '@kmamal/three';

import { ParallaxBarrierEffect } from '@kmamal/three/addons/effects/ParallaxBarrierEffect.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - effects - parallax barrier', api: 'webgl' } );

let camera, scene, renderer, effect;

const spheres = [];

let mouseX = 0;
let mouseY = 0;

let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

document.addEventListener( 'mousemove', onDocumentMouseMove );

init();

function init() {

	camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.01, 100 );
	camera.position.z = 3;

	const path = 'textures/cube/pisa/';
	const format = '.png';
	const urls = [
		path + 'px' + format, path + 'nx' + format,
		path + 'py' + format, path + 'ny' + format,
		path + 'pz' + format, path + 'nz' + format
	];

	const textureCube = new THREE.CubeTextureLoader().load( urls );

	scene = new THREE.Scene();
	scene.background = textureCube;

	const geometry = new THREE.SphereGeometry( 0.1, 32, 16 );
	const material = new THREE.MeshBasicMaterial( { color: 0xffffff, envMap: textureCube } );

	for ( let i = 0; i < 500; i ++ ) {

		const mesh = new THREE.Mesh( geometry, material );

		mesh.position.x = Math.random() * 10 - 5;
		mesh.position.y = Math.random() * 10 - 5;
		mesh.position.z = Math.random() * 10 - 5;

		mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 3 + 1;

		scene.add( mesh );

		spheres.push( mesh );

	}

	//

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setAnimationLoop( animate );

	const width = window.innerWidth || 2;
	const height = window.innerHeight || 2;

	effect = new ParallaxBarrierEffect( renderer );
	effect.setSize( width, height );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	windowHalfX = window.innerWidth / 2;
	windowHalfY = window.innerHeight / 2;

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	effect.setSize( window.innerWidth, window.innerHeight );

}

function onDocumentMouseMove( event ) {

	mouseX = ( event.clientX - windowHalfX ) / 100;
	mouseY = ( event.clientY - windowHalfY ) / 100;

}

//

function animate() {

	const timer = 0.0001 * Date.now();

	camera.position.x += ( mouseX - camera.position.x ) * .05;
	camera.position.y += ( - mouseY - camera.position.y ) * .05;

	camera.lookAt( scene.position );

	for ( let i = 0, il = spheres.length; i < il; i ++ ) {

		const sphere = spheres[ i ];

		sphere.position.x = 5 * Math.cos( timer + i );
		sphere.position.y = 5 * Math.sin( timer + i * 1.1 );

	}

	effect.render( scene, camera );

}
