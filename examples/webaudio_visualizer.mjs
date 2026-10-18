import * as THREE from '@kmamal/three';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webaudio - visualizer', api: 'webgl' } );

const shaders = {
	vertexShader: `varying vec2 vUv;

void main() {

	vUv = uv;

	gl_Position = vec4( position, 1.0 );

}`,
	fragmentShader: `uniform sampler2D tAudioData;
varying vec2 vUv;

void main() {

	vec3 backgroundColor = vec3( 0.125, 0.125, 0.125 );
	vec3 color = vec3( 1.0, 1.0, 0.0 );

	float f = texture2D( tAudioData, vec2( vUv.x, 0.0 ) ).r;

	float i = step( vUv.y, f ) * step( f - 0.0125, vUv.y );

	gl_FragColor = vec4( mix( backgroundColor, color, i ), 1.0 );

}`
};

let scene, camera, renderer, analyser, uniforms;

init();

function init() {

	const fftSize = 128;

	//

	scene = new THREE.Scene();

	camera = new THREE.Camera();

	//

	const listener = new THREE.AudioListener();

	const audio = new THREE.Audio( listener );
	const file = './sounds/376737_Skullbeatz___Bad_Cat_Maste.mp3';

	const mediaElement = new Audio( file );
	mediaElement.play();

	audio.setMediaElementSource( mediaElement );

	analyser = new THREE.AudioAnalyser( audio, fftSize );

	//

	uniforms = {

		tAudioData: { value: new THREE.DataTexture( analyser.data, fftSize / 2, 1, THREE.RedFormat ) }

	};

	const material = new THREE.ShaderMaterial( {

		uniforms: uniforms,
		vertexShader: shaders.vertexShader,
		fragmentShader: shaders.fragmentShader

	} );

	const geometry = new THREE.PlaneGeometry( 1, 1 );

	const mesh = new THREE.Mesh( geometry, material );
	scene.add( mesh );

	//

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	analyser.getFrequencyData();

	uniforms.tAudioData.value.needsUpdate = true;

	renderer.render( scene, camera );

}
