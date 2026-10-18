import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - 2D compressed texture array', api: 'webgl' } );

const shaders = {
	vs: `uniform vec2 size;
out vec2 vUv;

void main() {

	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

	// Convert position.xy to 1.0-0.0

	vUv.xy = position.xy / size + 0.5;
	vUv.y = 1.0 - vUv.y; // original data is upside down

}`,
	fs: `precision highp float;
precision highp int;
precision highp sampler2DArray;

uniform sampler2DArray diffuse;
in vec2 vUv;
uniform int depth;

out vec4 outColor;

void main() {

	vec4 color = texture( diffuse, vec3( vUv, depth ) );

	// lighten a bit
	outColor = vec4( color.rgb + .2, 1.0 );

}`
};

let camera, scene, mesh, renderer, stats, timer;

const planeWidth = 50;
const planeHeight = 25;

let depthStep = 1;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 2000 );
	camera.position.z = 70;

	scene = new THREE.Scene();

	//
	timer = new THREE.Timer();
	timer.connect( document );

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	const ktx2Loader = new KTX2Loader();
	ktx2Loader.detectSupport( renderer );

	ktx2Loader.load( 'textures/spiritedaway.ktx2', function ( texturearray ) {

		const material = new THREE.ShaderMaterial( {
			uniforms: {
				diffuse: { value: texturearray },
				depth: { value: 55 },
				size: { value: new THREE.Vector2( planeWidth, planeHeight ) }
			},
			vertexShader: shaders.vs.trim(),
			fragmentShader: shaders.fs.trim(),
			glslVersion: THREE.GLSL3
		} );

		const geometry = new THREE.PlaneGeometry( planeWidth, planeHeight );

		mesh = new THREE.Mesh( geometry, material );

		scene.add( mesh );

	} );

	stats = new Stats();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	timer.update();

	if ( mesh ) {

		const delta = timer.getDelta() * 10;

		depthStep += delta;

		const value = depthStep % 5;

		mesh.material.uniforms[ 'depth' ].value = value;

	}

	render();
	stats.update();

}

function render() {

	renderer.render( scene, camera );

}
