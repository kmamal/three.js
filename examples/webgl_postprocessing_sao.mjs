import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';

import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { SAOPass } from '@kmamal/three/addons/postprocessing/SAOPass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - post processing - Scalable Ambient Occlusion (SAO)', api: 'webgl' } );

let stats;
let camera, scene, renderer;
let composer, renderPass, saoPass;
let group;

init();

function init() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( width, height );
	renderer.setAnimationLoop( animate );

	camera = new THREE.PerspectiveCamera( 65, width / height, 3, 10 );
	camera.position.z = 7;

	scene = new THREE.Scene();

	group = new THREE.Object3D();
	scene.add( group );

	const light = new THREE.PointLight( 0xefffef, 500 );
	light.position.z = 10;
	light.position.y = - 10;
	light.position.x = - 10;
	scene.add( light );

	const light2 = new THREE.PointLight( 0xffefef, 500 );
	light2.position.z = 10;
	light2.position.x = - 10;
	light2.position.y = 10;
	scene.add( light2 );

	const light3 = new THREE.PointLight( 0xefefff, 500 );
	light3.position.z = 10;
	light3.position.x = 10;
	light3.position.y = - 10;
	scene.add( light3 );

	const light4 = new THREE.AmbientLight( 0xffffff, 0.2 );
	scene.add( light4 );

	const geometry = new THREE.SphereGeometry( 3, 48, 24 );
	const material = new THREE.MeshStandardMaterial();
	material.roughness = 0.5;
	material.metalness = 0;

	const mesh = new THREE.InstancedMesh( geometry, material, 120 );
	const dummy = new THREE.Object3D();
	const color = new THREE.Color();

	for ( let i = 0; i < 120; i ++ ) {

		dummy.position.x = Math.random() * 4 - 2;
		dummy.position.y = Math.random() * 4 - 2;
		dummy.position.z = Math.random() * 4 - 2;
		dummy.rotation.x = Math.random();
		dummy.rotation.y = Math.random();
		dummy.rotation.z = Math.random();

		const scale = Math.random() * 0.2 + 0.05;
		dummy.scale.set( scale, scale, scale );

		dummy.updateMatrix();
		mesh.setMatrixAt( i, dummy.matrix );

		color.setHSL( Math.random(), 1.0, 0.3 );
		mesh.setColorAt( i, color );

	}

	group.add( mesh );

	stats = new Stats();

	composer = new EffectComposer( renderer );
	renderPass = new RenderPass( scene, camera );
	composer.addPass( renderPass );
	saoPass = new SAOPass( scene, camera );
	composer.addPass( saoPass );
	const outputPass = new OutputPass();
	composer.addPass( outputPass );

	// Init gui
	const gui = new GUI();
	gui.add( saoPass.params, 'output', {
		'Default': SAOPass.OUTPUT.Default,
		'SAO Only': SAOPass.OUTPUT.SAO,
		'Normal': SAOPass.OUTPUT.Normal
	} ).onChange( function ( value ) {

		saoPass.params.output = value;

	} );
	gui.add( saoPass.params, 'saoBias', - 1, 1 );
	gui.add( saoPass.params, 'saoIntensity', 0, 1 );
	gui.add( saoPass.params, 'saoScale', 0, 10 );
	gui.add( saoPass.params, 'saoKernelRadius', 1, 100 );
	gui.add( saoPass.params, 'saoMinResolution', 0, 1 );
	gui.add( saoPass.params, 'saoBlur' );
	gui.add( saoPass.params, 'saoBlurRadius', 0, 200 );
	gui.add( saoPass.params, 'saoBlurStdDev', 0.5, 150 );
	gui.add( saoPass.params, 'saoBlurDepthCutoff', 0.0, 0.1 );
	gui.add( saoPass, 'enabled' );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	const width = window.innerWidth || 1;
	const height = window.innerHeight || 1;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setSize( width, height );

	composer.setSize( width, height );

}

function animate() {

	stats.begin();
	render();
	stats.end();

}

function render() {

	const timer = performance.now();
	group.rotation.x = timer * 0.0002;
	group.rotation.y = timer * 0.0001;

	composer.render();

}
