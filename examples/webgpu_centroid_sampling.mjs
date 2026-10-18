import * as THREE from '@kmamal/three/webgpu';
import { varying, uv, texture, Fn } from '@kmamal/three/tsl';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, viewOf, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindowAntialiasingDisabled = createWindow( { title: 'three.js webgpu - centroid sampling - antialiasing disabled', api: 'webgpu' } );
const sdlWindowAntialiasingEnabled = createWindow( { title: 'three.js webgpu - centroid sampling - antialiasing enabled', api: 'webgpu' } );

const viewAntialiasingDisabled = viewOf( sdlWindowAntialiasingDisabled ).window;
const viewAntialiasingEnabled = viewOf( sdlWindowAntialiasingEnabled ).window;

let rendererAntialiasingEnabled;
let rendererAntialiasingDisabled;
let camera;
let scene;
let gui;

const effectController = {
	sampling: 'normal'
};

const atlasCanvas = document.createElement( 'canvas' );
atlasCanvas.width = 16;
atlasCanvas.height = 16;

const ctx = atlasCanvas.getContext( '2d' );
ctx.fillStyle = 'red';
ctx.fillRect( 0, 0, 8, 8 );

const redUVs = [ 0, 1, 0.5, 1, 0.5, 0.5, 0, 0.5 ];
ctx.fillStyle = 'green';
ctx.fillRect( 8, 0, 8, 8 );

const greenUVs = [ 1, 1, 0.5, 1, 0.5, 0.5, 1, 0.5 ];

ctx.fillStyle = 'blue';
ctx.fillRect( 0, 8, 8, 8 );

const blueUVs = [ 0, 0, 0.5, 0, 0.5, 0.5, 0, 0.5 ];

ctx.fillStyle = 'yellow';
ctx.fillRect( 8, 8, 8, 8 );

const yellowUVs = [ 1, 0, 0.5, 0, 0.5, 0.5, 1, 0.5 ];

const faces = [ redUVs, greenUVs, blueUVs, yellowUVs ];

const canvasTexture = new THREE.CanvasTexture( atlasCanvas );
canvasTexture.colorSpace = THREE.SRGBColorSpace;
canvasTexture.mapping = THREE.UVMapping;
canvasTexture.wrapS = THREE.RepeatWrapping;
canvasTexture.wrapT = THREE.RepeatWrapping;
canvasTexture.magFilter = THREE.NearestFilter;
canvasTexture.minFilter = THREE.NearestFilter;
canvasTexture.format = THREE.RGBAFormat;
canvasTexture.type = THREE.UnsignedByteType;

const forceWebGL = false;

init();

function init() {

	camera = new THREE.PerspectiveCamera();
	camera.fov = 60;
	camera.near = 1;
	camera.far = 2100;
	camera.position.z = 50;

	scene = new THREE.Scene();

	const makeFaceGeometry = ( uvs ) => {

		const geometry = new THREE.BufferGeometry();
		const positions = [ - 1, - 1, 0, 1, - 1, 0, 1, 1, 0, - 1, 1, 0 ];
		geometry.setAttribute(
			'position',
			new THREE.BufferAttribute( new Float32Array( positions ), 3 )
		);

		const indices = [ 0, 1, 2, 2, 3, 0 ];
		geometry.setIndex( indices );

		geometry.setAttribute(
			'uv',
			new THREE.BufferAttribute( new Float32Array( uvs ), 2 )
		);

		return geometry;

	};

	const material = new THREE.MeshBasicNodeMaterial();
	const testUV = varying( uv(), 'testUV' );

	const createShader = ( type, sampling ) => {

		return Fn( () => {

			testUV.setInterpolation( type, sampling );

			return texture( canvasTexture, testUV ).rgb;

		} );

	};

	const withFlatFirstShader = createShader( THREE.InterpolationSamplingType.FLAT, THREE.InterpolationSamplingMode.FIRST );
	const withFlatEitherShader = createShader( THREE.InterpolationSamplingType.FLAT, THREE.InterpolationSamplingMode.EITHER );

	const withSampleShader = Fn( () => {

		testUV.setInterpolation( THREE.InterpolationSamplingType.PERSPECTIVE, THREE.InterpolationSamplingMode.SAMPLE );

		return texture( canvasTexture, testUV ).rgb;

	} );

	const withInterpolationShader = Fn( () => {

		testUV.setInterpolation( THREE.InterpolationSamplingType.PERSPECTIVE, THREE.InterpolationSamplingMode.CENTROID );

		return texture( canvasTexture, testUV ).rgb;

	} );

	const withoutInterpolationShader = Fn( () => {

		return texture( canvasTexture, uv() ).rgb;

	} );

	material.colorNode = withoutInterpolationShader();

	const faceMeshes = [];

	for ( let x = - 5; x < 5; x ++ ) {

		for ( let y = - 5; y < 5; y ++ ) {

			const face = faces[ Math.floor( Math.random() * faces.length ) ];
			const geometry = makeFaceGeometry( face );
			const mesh = new THREE.Mesh( geometry, material );
			mesh.position.set( x * 2, y * 2, 0 );
			faceMeshes.push( mesh );
			scene.add( mesh );

		}

	}

	// Create Standard Renderer
	rendererAntialiasingDisabled = new THREE.WebGPURenderer( {
		window: sdlWindowAntialiasingDisabled,
		antialias: false,
		forceWebGL: forceWebGL
	} );

	rendererAntialiasingDisabled.setPixelRatio( viewAntialiasingDisabled.devicePixelRatio );
	rendererAntialiasingDisabled.setSize( viewAntialiasingDisabled.innerWidth, viewAntialiasingDisabled.innerHeight );
	rendererAntialiasingDisabled.setAnimationLoop( animateStandard );

	// Create antialiased renderer
	rendererAntialiasingEnabled = new THREE.WebGPURenderer( {
		window: sdlWindowAntialiasingEnabled,
		antialias: true,
		forceWebGL: forceWebGL
	} );

	rendererAntialiasingEnabled.setPixelRatio( viewAntialiasingEnabled.devicePixelRatio );
	rendererAntialiasingEnabled.setSize( viewAntialiasingEnabled.innerWidth, viewAntialiasingEnabled.innerHeight );
	rendererAntialiasingEnabled.setAnimationLoop( animateAliased );

	onWindowResize();

	viewAntialiasingDisabled.addEventListener( 'resize', onWindowResize );
	viewAntialiasingEnabled.addEventListener( 'resize', onWindowResize );

	gui = new GUI( { title: 'Settings' } );
	gui.add( effectController, 'sampling', [
		THREE.InterpolationSamplingMode.NORMAL,
		THREE.InterpolationSamplingMode.CENTROID,
		THREE.InterpolationSamplingMode.SAMPLE,
		'flat first',
		'flat either'
	] ).onChange( () => {

		const interpolationShaderLib = {
			[ THREE.InterpolationSamplingMode.NORMAL ]: withoutInterpolationShader,
			[ THREE.InterpolationSamplingMode.CENTROID ]: withInterpolationShader,
			[ THREE.InterpolationSamplingMode.SAMPLE ]: withSampleShader,
			[ 'flat first' ]: withFlatFirstShader,
			[ 'flat either' ]: withFlatEitherShader
		};

		const shader = interpolationShaderLib[ effectController.sampling ];

		for ( let i = 0; i < faceMeshes.length; i ++ ) {

			faceMeshes[ i ].material.colorNode = shader();
			faceMeshes[ i ].material.needsUpdate = true;

		}

	} );

}

function onWindowResize() {

	rendererAntialiasingDisabled.setSize( viewAntialiasingDisabled.innerWidth, viewAntialiasingDisabled.innerHeight );
	rendererAntialiasingEnabled.setSize( viewAntialiasingEnabled.innerWidth, viewAntialiasingEnabled.innerHeight );
	const aspect = viewAntialiasingDisabled.innerWidth / viewAntialiasingDisabled.innerHeight;

	camera.aspect = aspect;
	camera.updateProjectionMatrix();

}

function animateStandard() {

	rendererAntialiasingDisabled.render( scene, camera );

}

function animateAliased() {

	rendererAntialiasingEnabled.render( scene, camera );

}
