import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - scene - multiple - compare', api: 'webgl' } );

let camera, renderer, controls;
let sceneL, sceneR;

let sliderPos = window.innerWidth / 2;

init();

function init() {

	sceneL = new THREE.Scene();
	sceneL.background = new THREE.Color( 0xBCD48F );

	sceneR = new THREE.Scene();
	sceneR.background = new THREE.Color( 0x8FBCD4 );

	camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 6;

	const light = new THREE.HemisphereLight( 0xffffff, 0x444444, 3 );
	light.position.set( - 2, 2, 2 );
	sceneL.add( light.clone() );
	sceneR.add( light.clone() );

	initMeshes();
	initSlider();

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setScissorTest( true );
	renderer.setAnimationLoop( animate );

	controls = new OrbitControls( camera, renderer.domElement );

	window.addEventListener( 'resize', onWindowResize );

}

function initMeshes() {

	const geometry = new THREE.IcosahedronGeometry( 1, 3 );

	const meshL = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial() );
	sceneL.add( meshL );

	const meshR = new THREE.Mesh( geometry, new THREE.MeshStandardMaterial( { wireframe: true } ) );
	sceneR.add( meshR );

}

function initSlider() {

	const slider = document.querySelector( '.slider' );

	function onPointerDown() {

		if ( event.isPrimary === false ) return;

		controls.enabled = false;

		window.addEventListener( 'pointermove', onPointerMove );
		window.addEventListener( 'pointerup', onPointerUp );

	}

	function onPointerUp() {

		controls.enabled = true;

		window.removeEventListener( 'pointermove', onPointerMove );
		window.removeEventListener( 'pointerup', onPointerUp );

	}

	function onPointerMove( e ) {

		if ( event.isPrimary === false ) return;

		sliderPos = Math.max( 0, Math.min( window.innerWidth, e.pageX ) );

		slider.style.left = sliderPos - ( slider.offsetWidth / 2 ) + 'px';

	}

	slider.style.touchAction = 'none'; // disable touch scroll
	slider.addEventListener( 'pointerdown', onPointerDown );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	renderer.setScissor( 0, 0, sliderPos, window.innerHeight );
	renderer.render( sceneL, camera );

	renderer.setScissor( sliderPos, 0, window.innerWidth, window.innerHeight );
	renderer.render( sceneR, camera );

}
