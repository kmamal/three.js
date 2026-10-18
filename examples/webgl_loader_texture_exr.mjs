import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { EXRLoader } from '@kmamal/three/addons/loaders/EXRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - materials - EXR texture loader', api: 'webgl' } );

const params = {
	exposure: 2.0
};

let renderer, scene, camera;

init();

function init() {

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );

	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMappingExposure = params.exposure;

	scene = new THREE.Scene();

	const aspect = window.innerWidth / window.innerHeight;

	camera = new THREE.OrthographicCamera( - aspect, aspect, 1, - 1, 0, 1 );

	new EXRLoader()
		.load( 'textures/memorial.exr', function ( texture, textureData ) {

			// memorial.exr is NPOT

			//console.log( textureData );
			//console.log( texture );

			// EXRLoader sets these default settings
			//texture.generateMipmaps = false;
			//texture.minFilter = LinearFilter;
			//texture.magFilter = LinearFilter;

			const material = new THREE.MeshBasicMaterial( { map: texture } );

			const quad = new THREE.PlaneGeometry( 1.5 * textureData.width / textureData.height, 1.5 );

			const mesh = new THREE.Mesh( quad, material );

			scene.add( mesh );

			render();

		} );

	//

	const gui = new GUI();

	gui.add( params, 'exposure', 0, 4, 0.01 ).onChange( render );
	gui.open();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	const aspect = window.innerWidth / window.innerHeight;

	const frustumHeight = camera.top - camera.bottom;

	camera.left = - frustumHeight * aspect / 2;
	camera.right = frustumHeight * aspect / 2;

	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();

}

//

function render() {

	renderer.toneMappingExposure = params.exposure;

	renderer.render( scene, camera );

}
