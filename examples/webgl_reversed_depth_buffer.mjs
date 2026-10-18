// https://webgpu.github.io/webgpu-samples/?sample=reversedZ
import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { EffectComposer } from '@kmamal/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '@kmamal/three/addons/postprocessing/RenderPass.js';
import { OutputPass } from '@kmamal/three/addons/postprocessing/OutputPass.js';
import { createWindow, viewOf, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = {
	normal: createWindow( { title: 'three.js webgl - reverse depth buffer - normal', api: 'webgl' } ),
	logarithmic: createWindow( { title: 'three.js webgl - reverse depth buffer - logarithmic', api: 'webgl' } ),
	reverse: createWindow( { title: 'three.js webgl - reverse depth buffer - reverse', api: 'webgl' } )
};

const views = {
	normal: viewOf( sdlWindows.normal ).window,
	logarithmic: viewOf( sdlWindows.logarithmic ).window,
	reverse: viewOf( sdlWindows.reverse ).window
};

let stats, camera, reversedCamera, scene;
let normalRenderer, logarithmicRenderer, reverseRenderer;
let normalComposer, logarithmicComposer, reverseComposer;
const meshes = [];

const renderTarget = new THREE.WebGLRenderTarget();
renderTarget.depthTexture = new THREE.DepthTexture();
renderTarget.depthTexture.type = THREE.FloatType;

init();
animate();

function init() {

	stats = new Stats();

	camera = new THREE.PerspectiveCamera( 72, views.normal.innerWidth / views.normal.innerHeight, 5, 9999 );
	camera.position.z = 12;

	reversedCamera = camera.clone();

	scene = new THREE.Scene();

	const xCount = 1;
	const yCount = 5;
	const numInstances = xCount * yCount;

	const d = 0.0001; // half distance between two planes
	const o = 0.5; // half x offset to shift planes so they are only partially overlapping

	const positions = new Float32Array( [
		- 1 - o, - 1, d,
		1 - o, - 1, d,
		- 1 - o, 1, d,
		1 - o, - 1, d,
		1 - o, 1, d,
		- 1 - o, 1, d,

		- 1 + o, - 1, - d,
		1 + o, - 1, - d,
		- 1 + o, 1, - d,
		1 + o, - 1, - d,
		1 + o, 1, - d,
		- 1 + o, 1, - d,
	] );

	const colors = new Float32Array( [
		1, 0, 0,
		1, 0, 0,
		1, 0, 0,
		1, 0, 0,
		1, 0, 0,
		1, 0, 0,

		0, 1, 0,
		0, 1, 0,
		0, 1, 0,
		0, 1, 0,
		0, 1, 0,
		0, 1, 0,
	] );

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute( 'position', new THREE.BufferAttribute( positions, 3 ) );
	geometry.setAttribute( 'color', new THREE.BufferAttribute( colors, 3 ) );

	const material = new THREE.MeshBasicMaterial( { vertexColors: true } );

	for ( let i = 0; i < numInstances; i ++ ) {

		const mesh = new THREE.Mesh( geometry, material );
		meshes.push( mesh );
		scene.add( mesh );

	}

	let i = 0;
	for ( let x = 0; x < xCount; x ++ ) {

		for ( let y = 0; y < yCount; y ++ ) {

			const z = - 800 * i;
			const s = 1 + 50 * i;

			const mesh = meshes[ i ];
			mesh.position.set(
				x - xCount / 2 + 0.5,
				( 4.0 - 0.2 * z ) * ( y - yCount / 2 + 1.0 ),
				z
			);
			mesh.scale.setScalar( s );

			i ++;

		}

	}

	normalRenderer = new THREE.WebGLRenderer( { window: sdlWindows.normal } );
	normalRenderer.setPixelRatio( views.normal.devicePixelRatio );
	normalRenderer.setSize( views.normal.innerWidth, views.normal.innerHeight );

	normalComposer = new EffectComposer( normalRenderer, renderTarget );
	normalComposer.addPass( new RenderPass( scene, camera ) );
	normalComposer.addPass( new OutputPass() );

	logarithmicRenderer = new THREE.WebGLRenderer( { logarithmicDepthBuffer: true, window: sdlWindows.logarithmic } );
	logarithmicRenderer.setPixelRatio( views.logarithmic.devicePixelRatio );
	logarithmicRenderer.setSize( views.logarithmic.innerWidth, views.logarithmic.innerHeight );

	logarithmicComposer = new EffectComposer( logarithmicRenderer, renderTarget );
	logarithmicComposer.addPass( new RenderPass( scene, camera ) );
	logarithmicComposer.addPass( new OutputPass() );

	reverseRenderer = new THREE.WebGLRenderer( { reversedDepthBuffer: true, window: sdlWindows.reverse } );
	reverseRenderer.setPixelRatio( views.reverse.devicePixelRatio );
	reverseRenderer.setSize( views.reverse.innerWidth, views.reverse.innerHeight );

	reverseComposer = new EffectComposer( reverseRenderer, renderTarget );
	reverseComposer.addPass( new RenderPass( scene, reversedCamera ) );
	reverseComposer.addPass( new OutputPass() );

	for ( const name in views ) views[ name ].addEventListener( 'resize', onWindowResize );
	onWindowResize();

}

function animate() {

	window.requestAnimationFrame( animate );

	const now = performance.now() / 1000;

	for ( let i = 0; i < meshes.length; i ++ ) {

		const angle = THREE.MathUtils.degToRad( 30 );
		const axis = new THREE.Vector3( Math.sin( now ), Math.cos( now ), 0 );
		meshes[ i ].quaternion.setFromAxisAngle( axis, angle );

	}

	render();

}

function render() {

	normalComposer.render();
	logarithmicComposer.render();
	reverseComposer.render();

	stats.update();

}

function onWindowResize() {

	for ( const [ name, composer, renderer ] of [
		[ 'normal', normalComposer, normalRenderer ],
		[ 'logarithmic', logarithmicComposer, logarithmicRenderer ],
		[ 'reverse', reverseComposer, reverseRenderer ]
	] ) {

		const view = views[ name ];
		const width = view.innerWidth;
		const height = view.innerHeight;
		const dpr = view.devicePixelRatio;

		composer.setSize( width * dpr, height * dpr );
		renderer.setSize( width, height );

	}

	const aspect = views.normal.innerWidth / views.normal.innerHeight;

	camera.aspect = aspect;
	camera.updateProjectionMatrix();

	reversedCamera.aspect = aspect;
	reversedCamera.updateProjectionMatrix();

}
