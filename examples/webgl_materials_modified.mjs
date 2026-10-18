import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - materials - modified', api: 'webgl' } );

let camera, scene, renderer, stats;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 27, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.z = 20;

	scene = new THREE.Scene();

	const loader = new GLTFLoader();
	loader.load( 'models/gltf/LeePerrySmith/LeePerrySmith.glb', function ( gltf ) {

		const geometry = gltf.scene.children[ 0 ].geometry;

		let mesh = new THREE.Mesh( geometry, buildTwistMaterial( 2.0 ) );
		mesh.position.x = - 3.5;
		mesh.position.y = - 0.5;
		scene.add( mesh );

		mesh = new THREE.Mesh( geometry, buildTwistMaterial( - 2.0 ) );
		mesh.position.x = 3.5;
		mesh.position.y = - 0.5;
		scene.add( mesh );

	} );

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 10;
	controls.maxDistance = 50;

	//

	stats = new Stats();

	// EVENTS

	window.addEventListener( 'resize', onWindowResize );

}

function buildTwistMaterial( amount ) {

	const material = new THREE.MeshNormalMaterial();
	material.onBeforeCompile = function ( shader ) {

		shader.uniforms.time = { value: 0 };

		shader.vertexShader = 'uniform float time;\n' + shader.vertexShader;
		shader.vertexShader = shader.vertexShader.replace(
			'#include <begin_vertex>',
			[
				`float theta = sin( time + position.y ) / ${ amount.toFixed( 1 ) };`,
				'float c = cos( theta );',
				'float s = sin( theta );',
				'mat3 m = mat3( c, 0, s, 0, 1, 0, -s, 0, c );',
				'vec3 transformed = vec3( position ) * m;',
				'vNormal = vNormal * m;'
			].join( '\n' )
		);

		material.userData.shader = shader;

	};

	// Make sure WebGLRenderer doesn't reuse a single program

	material.customProgramCacheKey = function () {

		return amount.toFixed( 1 );

	};

	return material;

}

//

function onWindowResize() {

	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize( width, height );

}

//

function animate() {

	render();

	stats.update();

}

function render() {

	scene.traverse( function ( child ) {

		if ( child.isMesh ) {

			const shader = child.material.userData.shader;

			if ( shader ) {

				shader.uniforms.time.value = performance.now() / 1000;

			}

		}

	} );

	renderer.render( scene, camera );

}
