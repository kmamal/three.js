import * as THREE from '@kmamal/three';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from '@kmamal/three/addons/geometries/RoundedBoxGeometry.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import lottie from 'lottie-web';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - lottie loader', api: 'webgl' } );

let renderer, scene, camera, controls;
let mesh;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 10 );
	camera.position.z = 2.5;

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x111111 );

	// lottie

	const loader = new THREE.FileLoader();
	loader.setResponseType( 'json' );
	loader.load( 'textures/lottie/24017-lottie-logo-animation.json', function ( data ) {

		const dpr = window.devicePixelRatio;
		renderer.domElement.style.width = data.w * dpr + 'px';
		renderer.domElement.style.height = data.h * dpr + 'px';

		const animation = lottie.loadAnimation( {
			container: renderer.domElement,
			animType: 'canvas',
			loop: true,
			autoplay: true,
			animationData: data,
			rendererSettings: { dpr: dpr }
		} );

		const texture = new THREE.CanvasTexture( animation.container );
		texture.minFilter = THREE.NearestFilter;
		texture.generateMipmaps = false;
		texture.colorSpace = THREE.SRGBColorSpace;

		animation.addEventListener( 'enterFrame', function () {

			texture.needsUpdate = true;

		} );

		renderer.domElement.style.display = 'none'; // must be done after loadAnimation() otherwise canvas has 0 dimensions

		setupControls( animation );

		// texture = new THREE.TextureLoader().load( 'textures/uv_grid_directx.jpg' );
		// texture.colorSpace = THREE.SRGBColorSpace;

		const geometry = new RoundedBoxGeometry( 1, 1, 1, 7, 0.1 );
		const material = new THREE.MeshStandardMaterial( { roughness: 0, map: texture } );
		mesh = new THREE.Mesh( geometry, material );
		scene.add( mesh );

	} );

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.environment = pmremGenerator.fromScene( environment, 0.04 ).texture;

	controls = new OrbitControls( camera, renderer.domElement );
	controls.autoRotate = true;

	//

	window.addEventListener( 'resize', onWindowResize );

}

function setupControls( animation ) {

	// Lottie animation API
	// https://airbnb.io/lottie/#/web

	// There are a few undocumented properties:
	// console.log( animation );

	const scrubber = document.getElementById( 'scrubber' );
	scrubber.max = animation.totalFrames;

	scrubber.addEventListener( 'pointerdown', function () {

		animation.pause();

	} );

	scrubber.addEventListener( 'pointerup', function () {

		animation.play();

	} );

	scrubber.addEventListener( 'input', function () {

		animation.goToAndStop( parseFloat( scrubber.value ), true );

	} );

	animation.addEventListener( 'enterFrame', function () {

		scrubber.value = animation.currentFrame;

	} );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {

	controls.update();

	renderer.render( scene, camera );

}
