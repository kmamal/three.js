import * as THREE from '@kmamal/three/webgpu';
import { pass } from '@kmamal/three/tsl';
import { createWindow, viewOf, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = {
	normal: createWindow( { title: 'three.js webgpu - reverse depth buffer - normal', api: 'webgpu' } ),
	logarithmic: createWindow( { title: 'three.js webgpu - reverse depth buffer - logarithmic', api: 'webgpu' } ),
	reverse: createWindow( { title: 'three.js webgpu - reverse depth buffer - reverse', api: 'webgpu' } )
};

const views = {
	normal: viewOf( sdlWindows.normal ).window,
	logarithmic: viewOf( sdlWindows.logarithmic ).window,
	reverse: viewOf( sdlWindows.reverse ).window
};

let camera, reversedCamera, scene;
let normalRenderer, logarithmicRenderer, reverseRenderer;
let normalRenderPipeline, logarithmicRenderPipeline, reverseRenderPipeline;
const meshes = [];

init().then( animate );

async function init() {

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

	normalRenderer = new THREE.WebGPURenderer( { window: sdlWindows.normal } );
	normalRenderer.setPixelRatio( views.normal.devicePixelRatio );
	normalRenderer.setSize( views.normal.innerWidth, views.normal.innerHeight );

	logarithmicRenderer = new THREE.WebGPURenderer( { logarithmicDepthBuffer: true, window: sdlWindows.logarithmic } );
	logarithmicRenderer.setPixelRatio( views.logarithmic.devicePixelRatio );
	logarithmicRenderer.setSize( views.logarithmic.innerWidth, views.logarithmic.innerHeight );

	reverseRenderer = new THREE.WebGPURenderer( { reversedDepthBuffer: true, window: sdlWindows.reverse } );
	reverseRenderer.setPixelRatio( views.reverse.devicePixelRatio );
	reverseRenderer.setSize( views.reverse.innerWidth, views.reverse.innerHeight );

	//

	normalRenderPipeline = new THREE.RenderPipeline( normalRenderer );
	normalRenderPipeline.outputNode = pass( scene, camera );

	logarithmicRenderPipeline = new THREE.RenderPipeline( logarithmicRenderer );
	logarithmicRenderPipeline.outputNode = pass( scene, camera );

	reverseRenderPipeline = new THREE.RenderPipeline( reverseRenderer );
	reverseRenderPipeline.outputNode = pass( scene, reversedCamera );

	await Promise.all( [ normalRenderer.init(), logarithmicRenderer.init(), reverseRenderer.init() ] );

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

	normalRenderPipeline.render();
	logarithmicRenderPipeline.render();
	reverseRenderPipeline.render();

}

function onWindowResize() {

	normalRenderer.setSize( views.normal.innerWidth, views.normal.innerHeight );
	logarithmicRenderer.setSize( views.logarithmic.innerWidth, views.logarithmic.innerHeight );
	reverseRenderer.setSize( views.reverse.innerWidth, views.reverse.innerHeight );

	const aspect = views.normal.innerWidth / views.normal.innerHeight;

	camera.aspect = aspect;
	camera.updateProjectionMatrix();

	reversedCamera.aspect = aspect;
	reversedCamera.updateProjectionMatrix();

}
