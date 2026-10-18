import * as THREE from '@kmamal/three/webgpu';
import { color, cos, float, mix, range, sin, time, uniform, uv, vec3, vec4, TWO_PI } from '@kmamal/three/tsl';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - galaxy', api: 'webgpu' } );

let camera, scene, renderer, controls;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 4, 2, 5 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x201919 );

	// galaxy

	const material = new THREE.SpriteNodeMaterial( {
		depthWrite: false,
		blending: THREE.AdditiveBlending
	} );

	const size = uniform( 0.08 );
	material.scaleNode = range( 0, 1 ).mul( size );

	const radiusRatio = range( 0, 1 );
	const radius = radiusRatio.pow( 1.5 ).mul( 5 ).toVar();

	const branches = 3;
	const branchAngle = range( 0, branches ).floor().mul( TWO_PI.div( branches ) );
	const angle = branchAngle.add( time.mul( radiusRatio.oneMinus() ) );

	const position = vec3(
		cos( angle ),
		0,
		sin( angle )
	).mul( radius );

	const randomOffset = range( vec3( - 1 ), vec3( 1 ) ).pow3().mul( radiusRatio ).add( 0.2 );

	material.positionNode = position.add( randomOffset );

	const colorInside = uniform( color( '#ffa575' ) );
	const colorOutside = uniform( color( '#311599' ) );
	const colorFinal = mix( colorInside, colorOutside, radiusRatio.oneMinus().pow( 2 ).oneMinus() );
	const alpha = float( 0.1 ).div( uv().sub( 0.5 ).length() ).sub( 0.2 );
	material.colorNode = vec4( colorFinal, alpha );

	const mesh = new THREE.InstancedMesh( new THREE.PlaneGeometry( 1, 1 ), material, 20000 );
	scene.add( mesh );

	// renderer

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.minDistance = 0.1;
	controls.maxDistance = 50;

	// events

	window.addEventListener( 'resize', onWindowResize );

	// debug

	const gui = new GUI( { title: 'Parameters' } );

	gui.add( size, 'value', 0, 1, 0.001 ).name( 'size' );

	gui.addColor( { color: colorInside.value.getHex( THREE.SRGBColorSpace ) }, 'color' )
		.name( 'colorInside' )
		.onChange( function ( value ) {

			colorInside.value.set( value );

		} );

	gui.addColor( { color: colorOutside.value.getHex( THREE.SRGBColorSpace ) }, 'color' )
		.name( 'colorOutside' )
		.onChange( function ( value ) {

			colorOutside.value.set( value );

		} );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();

	renderer.render( scene, camera );

}
