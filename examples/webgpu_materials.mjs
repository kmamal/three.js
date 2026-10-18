import * as THREE from '@kmamal/three/webgpu';

import { Fn, wgslFn, positionLocal, positionWorld, normalLocal, normalWorld, normalView, color, texture, uv, float, vec2, vec3, vec4, oscSine, triplanarTexture, screenUV, Loop, cameraProjectionMatrix } from '@kmamal/three/tsl';

import { TeapotGeometry } from '@kmamal/three/addons/geometries/TeapotGeometry.js';
import WebGPU from '@kmamal/three/addons/capabilities/WebGPU.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - materials', api: 'webgpu' } );

let camera, scene, renderer;

const objects = [], materials = [];

init();

function init() {

	if ( WebGPU.isAvailable() === false ) {

		throw new Error( 'No WebGPU support' );

	}

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.set( 0, 200, 800 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	// Grid

	const helper = new THREE.GridHelper( 1000, 40, 0x303030, 0x303030 );
	helper.position.y = - 75;
	scene.add( helper );

	// Materials

	const textureLoader = new THREE.TextureLoader();

	const uvTexture = textureLoader.load( './textures/uv_grid_opengl.jpg' );
	uvTexture.wrapS = THREE.RepeatWrapping;
	uvTexture.wrapT = THREE.RepeatWrapping;

	const opacityTexture = textureLoader.load( './textures/alphaMap.jpg' );
	opacityTexture.wrapS = THREE.RepeatWrapping;
	opacityTexture.wrapT = THREE.RepeatWrapping;

	let material;

	//
	//	BASIC
	//

	// PositionLocal
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = positionLocal;
	materials.push( material );

	// PositionWorld
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = positionWorld;
	materials.push( material );

	// NormalLocal
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = normalLocal;
	materials.push( material );

	// NormalWorld
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = normalWorld;
	materials.push( material );

	// NormalView
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = normalView;
	materials.push( material );

	// Texture
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = texture( uvTexture );
	materials.push( material );

	// Opacity
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = color( 0x0099FF );
	material.opacityNode = texture( uvTexture );
	material.transparent = true;
	materials.push( material );

	// AlphaTest
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = texture( uvTexture );
	material.opacityNode = texture( opacityTexture );
	material.alphaTestNode = 0.5;
	materials.push( material );

	// camera
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = cameraProjectionMatrix.mul( positionLocal );
	materials.push( material );

	// Normal
	material = new THREE.MeshNormalMaterial();
	material.opacity = .5;
	material.transparent = true;
	materials.push( material );

	//
	//	ADVANCED
	//

	// Custom ShaderNode ( desaturate filter )

	const desaturateShaderNode = Fn( ( input ) => {

		return vec3( 0.299, 0.587, 0.114 ).dot( input.color.xyz );

	} );

	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = desaturateShaderNode( { color: texture( uvTexture ) } );
	materials.push( material );

	// Custom ShaderNode(no inputs) > Approach 2

	const desaturateNoInputsShaderNode = Fn( () => {

		return vec3( 0.299, 0.587, 0.114 ).dot( texture( uvTexture ).xyz );

	} );

	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = desaturateNoInputsShaderNode();
	materials.push( material );

	// Custom WGSL ( desaturate filter )

	const desaturateWGSLFn = wgslFn( `
		fn desaturate( color:vec3<f32> ) -> vec3<f32> {

			let lum = vec3<f32>( 0.299, 0.587, 0.114 );

			return vec3<f32>( dot( lum, color ) );

		}
	` );

	// include example

	const someWGSLFn = wgslFn( `
		fn someFn( color:vec3<f32> ) -> vec3<f32> {

			return desaturate( color );

		}
	`, [ desaturateWGSLFn ] );

	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = someWGSLFn( { color: texture( uvTexture ) } );
	materials.push( material );

	// Custom WGSL

	const getWGSLTextureSample = wgslFn( `
		fn getWGSLTextureSample( tex: texture_2d<f32>, tex_sampler: sampler, uv:vec2<f32> ) -> vec4<f32> {

			return textureSample( tex, tex_sampler, uv ) * vec4<f32>( 0.0, 1.0, 0.0, 1.0 );

		}
	` );

	const textureNode = texture( uvTexture );

	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = getWGSLTextureSample( { tex: textureNode, tex_sampler: textureNode, uv: uv() } );
	materials.push( material );

	// Triplanar Texture Mapping
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = triplanarTexture( texture( uvTexture ), null, null, float( .01 ) );
	materials.push( material );

	// Screen Projection Texture
	material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = texture( uvTexture, screenUV.flipY() );
	materials.push( material );

	// Loop
	material = new THREE.MeshBasicNodeMaterial();
	materials.push( material );

	const loopCount = 10;
	material.colorNode = Loop( loopCount, ( { i } ) => {

		const output = vec4().toVar();
		const scale = oscSine().mul( .09 ); // just a value to test

		const scaleI = scale.mul( i );
		const scaleINeg = scaleI.negate();

		const leftUV = uv().add( vec2( scaleI, 0 ) );
		const rightUV = uv().add( vec2( scaleINeg, 0 ) );
		const topUV = uv().add( vec2( 0, scaleI ) );
		const bottomUV = uv().add( vec2( 0, scaleINeg ) );

		output.assign( output.add( texture( uvTexture, leftUV ) ) );
		output.assign( output.add( texture( uvTexture, rightUV ) ) );
		output.assign( output.add( texture( uvTexture, topUV ) ) );
		output.assign( output.add( texture( uvTexture, bottomUV ) ) );

		return output.div( loopCount * 4 );

	} );

	//
	// Geometry
	//

	const geometry = new TeapotGeometry( 50, 18 );

	for ( let i = 0, l = materials.length; i < l; i ++ ) {

		addMesh( geometry, materials[ i ] );

	}

	//

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function addMesh( geometry, material ) {

	const mesh = new THREE.Mesh( geometry, material );

	mesh.position.x = ( objects.length % 4 ) * 200 - 400;
	mesh.position.z = Math.floor( objects.length / 4 ) * 200 - 200;

	mesh.rotation.x = Math.random() * 200 - 100;
	mesh.rotation.y = Math.random() * 200 - 100;
	mesh.rotation.z = Math.random() * 200 - 100;

	objects.push( mesh );

	scene.add( mesh );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {

	const timer = 0.0001 * Date.now();

	camera.position.x = Math.cos( timer ) * 1000;
	camera.position.z = Math.sin( timer ) * 1000;

	camera.lookAt( scene.position );

	for ( let i = 0, l = objects.length; i < l; i ++ ) {

		const object = objects[ i ];

		object.rotation.x += 0.01;
		object.rotation.y += 0.005;

	}

	renderer.render( scene, camera );

}
