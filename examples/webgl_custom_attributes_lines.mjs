import * as THREE from '@kmamal/three';

import { FontLoader } from '@kmamal/three/addons/loaders/FontLoader.js';
import { TextGeometry } from '@kmamal/three/addons/geometries/TextGeometry.js';

import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - custom attributes [lines]', api: 'webgl' } );

const shaders = {
	vertexshader: `uniform float amplitude;

attribute vec3 displacement;
attribute vec3 customColor;

varying vec3 vColor;

void main() {

	vec3 newPosition = position + amplitude * displacement;

	vColor = customColor;

	gl_Position = projectionMatrix * modelViewMatrix * vec4( newPosition, 1.0 );

}`,
	fragmentshader: `uniform vec3 color;
uniform float opacity;

varying vec3 vColor;

void main() {

	gl_FragColor = vec4( vColor * color, opacity );

}`
};

let renderer, scene, camera, stats;

let line, uniforms;

const loader = new FontLoader();
loader.load( 'fonts/helvetiker_bold.typeface.json', function ( font ) {

	init( font );

} );

function init( font ) {

	camera = new THREE.PerspectiveCamera( 30, window.innerWidth / window.innerHeight, 1, 10000 );
	camera.position.z = 400;

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x050505 );

	uniforms = {

		amplitude: { value: 5.0 },
		opacity: { value: 0.3 },
		color: { value: new THREE.Color( 0xffffff ) }

	};

	const shaderMaterial = new THREE.ShaderMaterial( {

		uniforms: uniforms,
		vertexShader: shaders.vertexshader,
		fragmentShader: shaders.fragmentshader,
		blending: THREE.AdditiveBlending,
		depthTest: false,
		transparent: true

	} );

	const geometry = new TextGeometry( 'three.js', {

		font: font,

		size: 50,
		depth: 15,
		curveSegments: 10,

		bevelThickness: 5,
		bevelSize: 1.5,
		bevelEnabled: true,
		bevelSegments: 10,

	} );

	geometry.center();

	const count = geometry.attributes.position.count;

	const displacement = new THREE.Float32BufferAttribute( count * 3, 3 );
	geometry.setAttribute( 'displacement', displacement );

	const customColor = new THREE.Float32BufferAttribute( count * 3, 3 );
	geometry.setAttribute( 'customColor', customColor );

	const color = new THREE.Color( 0xffffff );

	for ( let i = 0, l = customColor.count; i < l; i ++ ) {

		color.setHSL( i / l, 0.5, 0.5 );
		color.toArray( customColor.array, i * customColor.itemSize );

	}

	line = new THREE.Line( geometry, shaderMaterial );
	line.rotation.x = 0.2;
	scene.add( line );

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	stats = new Stats();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	render();
	stats.update();

}

function render() {

	const time = Date.now() * 0.001;

	line.rotation.y = 0.25 * time;

	uniforms.amplitude.value = Math.sin( 0.5 * time );
	uniforms.color.value.offsetHSL( 0.0005, 0, 0 );

	const attributes = line.geometry.attributes;
	const array = attributes.displacement.array;

	for ( let i = 0, l = array.length; i < l; i += 3 ) {

		array[ i ] += 0.3 * ( 0.5 - Math.random() );
		array[ i + 1 ] += 0.3 * ( 0.5 - Math.random() );
		array[ i + 2 ] += 0.3 * ( 0.5 - Math.random() );

	}

	attributes.displacement.needsUpdate = true;

	renderer.render( scene, camera );

}
