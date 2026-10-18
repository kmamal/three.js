import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from '@kmamal/three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - postprocessing smaa', api: 'webgl' } );

let camera, scene, renderer, composer, stats, smaaPass;

const params = {
	enabled: true,
	autoRotate: true

};

init();

function init() {

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	stats = new Stats();

	//

	camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.z = 300;

	scene = new THREE.Scene();

	const geometry = new THREE.BoxGeometry( 120, 120, 120 );
	const material1 = new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe: true } );

	const mesh1 = new THREE.Mesh( geometry, material1 );
	mesh1.position.x = - 100;
	scene.add( mesh1 );

	const texture = new THREE.TextureLoader().load( 'textures/brick_diffuse.jpg' );
	texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	texture.colorSpace = THREE.SRGBColorSpace;

	const material2 = new THREE.MeshBasicMaterial( { map: texture } );

	const mesh2 = new THREE.Mesh( geometry, material2 );
	mesh2.position.x = 100;
	scene.add( mesh2 );

	// postprocessing

	composer = new EffectComposer( renderer );
	composer.addPass( new RenderPass( scene, camera ) );

	smaaPass = new SMAAPass();
	composer.addPass( smaaPass );

	const outputPass = new OutputPass();
	composer.addPass( outputPass );

	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI();

	const smaaFolder = gui.addFolder( 'SMAA' );
	smaaFolder.add( params, 'enabled' );

	const sceneFolder = gui.addFolder( 'Scene' );
	sceneFolder.add( params, 'autoRotate' );

}

function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );
	composer.setSize( width, height );

}

function animate() {

	stats.begin();

	if ( params.autoRotate === true ) {

		for ( let i = 0; i < scene.children.length; i ++ ) {

			const child = scene.children[ i ];

			child.rotation.x += 0.005;
			child.rotation.y += 0.01;

		}

	}

	smaaPass.enabled = params.enabled;

	composer.render();

	stats.end();

}
