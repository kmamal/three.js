import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from '@kmamal/three/addons/postprocessing/ShaderPass.js';

import { LuminosityShader } from '@kmamal/three/addons/shaders/LuminosityShader.js';
import { SobelOperatorShader } from '@kmamal/three/addons/shaders/SobelOperatorShader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - postprocessing - sobel (edge detection)', api: 'webgl' } );

let camera, scene, renderer, composer;

let effectSobel;

const params = {
	enable: true
};

init();

function init() {

	//

	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 1, 3 );
	camera.lookAt( scene.position );

	//

	const geometry = new THREE.TorusKnotGeometry( 1, 0.3, 256, 32 );
	const material = new THREE.MeshPhongMaterial( { color: 0xffff00 } );

	const mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	//

	const ambientLight = new THREE.AmbientLight( 0xe7e7e7 );
	scene.add( ambientLight );

	const pointLight = new THREE.PointLight( 0xffffff, 20 );
	camera.add( pointLight );
	scene.add( camera );

	//

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	// postprocessing

	composer = new EffectComposer( renderer );
	const renderPass = new RenderPass( scene, camera );
	composer.addPass( renderPass );

	// color to grayscale conversion

	const effectGrayScale = new ShaderPass( LuminosityShader );
	composer.addPass( effectGrayScale );

	// you might want to use a gaussian blur filter before
	// the next pass to improve the result of the Sobel operator

	// Sobel operator

	effectSobel = new ShaderPass( SobelOperatorShader );
	effectSobel.uniforms[ 'resolution' ].value.x = window.innerWidth * window.devicePixelRatio;
	effectSobel.uniforms[ 'resolution' ].value.y = window.innerHeight * window.devicePixelRatio;
	composer.addPass( effectSobel );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.enableZoom = false;

	//

	const gui = new GUI();

	gui.add( params, 'enable' );
	gui.open();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );
	composer.setSize( window.innerWidth, window.innerHeight );

	effectSobel.uniforms[ 'resolution' ].value.x = window.innerWidth * window.devicePixelRatio;
	effectSobel.uniforms[ 'resolution' ].value.y = window.innerHeight * window.devicePixelRatio;

}

function animate() {

	if ( params.enable === true ) {

		composer.render();

	} else {

		renderer.render( scene, camera );

	}

}
