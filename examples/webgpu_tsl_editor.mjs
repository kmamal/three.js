import * as THREE from '@kmamal/three/webgpu';
import { vec4 } from '@kmamal/three/tsl';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - tsl editor', api: 'webgpu' } );

init();

function init() {

	// add the dependencies

	const width = 200;
	const height = 200;

	const camera = new THREE.PerspectiveCamera( 70, width / height, 0.1, 10 );
	camera.position.z = .72;
	camera.lookAt( 0, 0, 0 );

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x222222 );

	const rendererDOM = document.getElementById( 'renderer' );

	const renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( 200, 200 );
	renderer.debug.diagnostics.keywords = true;

	const material = new THREE.NodeMaterial();
	material.fragmentNode = vec4( 0, 0, 0, 1 );

	const mesh = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), material );
	scene.add( mesh );

	//

	let compiling = false;

	renderer.setAnimationLoop( () => {

		if ( compiling ) return;

		renderer.render( scene, camera );

	} );

	// editor

	window.require.config( { paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.55.1/min/vs' } } );

	require( [ 'vs/editor/editor.main' ], () => {

		const options = {
			shader: 'fragment',
			outputColorSpace: THREE.SRGBColorSpace,
			output: 'WGSL',
			preview: true
		};

		let timeout = null;
		let rawShader = null;

		const editorDOM = document.getElementById( 'source' );
		const resultDOM = document.getElementById( 'result' );

		const tslCode = `// Simple uv.x animation

const { texture, uniform, vec2, vec4, uv, oscSine, time, grayscale } = await import( '@kmamal/three/tsl' );

const samplerTexture = new THREE.TextureLoader().load( './textures/uv_grid_opengl.jpg' );
samplerTexture.wrapS = THREE.RepeatWrapping;
samplerTexture.colorSpace = THREE.SRGBColorSpace;

const scaledTime = time.mul( .5 ); // .5 is speed
const uv0 = uv();
const animateUv = vec2( uv0.x.add( oscSine( scaledTime ) ), uv0.y );

// .setName() is optional
const myMap = texture( samplerTexture, animateUv ).rgb.setName( 'myTexture' );
const myColor = uniform( new THREE.Color( 0x0066ff ) ).setName( 'myColor' );
const opacity = .7;

const desaturatedMap = grayscale( myMap.rgb );

const finalColor = desaturatedMap.add( myColor );

output = vec4( finalColor, opacity );
`;

		const editor = window.monaco.editor.create( editorDOM, {
			value: tslCode,
			language: 'javascript',
			theme: 'vs-dark',
			automaticLayout: true,
			minimap: { enabled: false }
		} );

		const result = window.monaco.editor.create( resultDOM, {
			value: '',
			language: 'wgsl',
			theme: 'vs-dark',
			automaticLayout: true,
			readOnly: true,
			minimap: { enabled: false }
		} );

		const showCode = () => {

			result.setValue( rawShader[ options.shader + 'Shader' ] );
			result.revealLine( 1 );

		};

		const webGLRenderer = new THREE.WebGPURenderer( { forceWebGL: true, window: sdlWindow } );
		webGLRenderer.debug.diagnostics.keywords = true;

		const build = async () => {

			try {

				const AsyncFunction = async function () {}.constructor;

				const tslCode = `let output = null;\n${ editor.getValue() }\nreturn { output };`;
				const nodes = await ( new AsyncFunction( 'THREE', tslCode )( THREE ) );

				mesh.material.fragmentNode = nodes.output;
				mesh.material.needsUpdate = true;

				compiling = true;

				mesh.visible = false;

				if ( options.output === 'WGSL' ) {

					rawShader = await renderer.debug.getShaderAsync( scene, camera, mesh );

				} else if ( options.output === 'GLSL ES 3.0' ) {

					rawShader = await webGLRenderer.debug.getShaderAsync( scene, camera, mesh );

				}

				mesh.visible = true;

				compiling = false;

				showCode();

				// extra debug info

				/*const style = 'background-color: #333; color: white; font-style: italic; border: 2px solid #777; font-size: 22px;';

				console.log( '%c  [ WGSL ] Vertex Shader      ', style );
				console.log( rawShader.vertexShader );
				console.log( '%c  [ WGSL ] Fragment Shader    ', style );
				console.log( rawShader.fragmentShader );/**/

			} catch ( e ) {

				result.setValue( 'Error: ' + e.message );

			}

		};

		build();

		editor.getModel().onDidChangeContent( () => {

			if ( timeout ) clearTimeout( timeout );

			timeout = setTimeout( build, 1000 );

		} );

		// gui

		const gui = new GUI();

		gui.add( options, 'output', [ 'WGSL', 'GLSL ES 3.0' ] ).onChange( build );
		gui.add( options, 'shader', [ 'vertex', 'fragment' ] ).onChange( showCode );

		gui.add( options, 'outputColorSpace', [ THREE.LinearSRGBColorSpace, THREE.SRGBColorSpace ] ).onChange( ( value ) => {

			renderer.outputColorSpace = value;

			build();

		} );

		gui.add( options, 'preview' ).onChange( ( value ) => {

			rendererDOM.style.display = value ? '' : 'none';

		} );

	} );

}
