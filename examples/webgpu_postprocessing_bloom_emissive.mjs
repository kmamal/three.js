import * as THREE from '@kmamal/three/webgpu';
import { pass, mrt, output, emissive, vec4 } from '@kmamal/three/tsl';
import { bloom } from '@kmamal/three/addons/tsl/display/BloomNode.js';

import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - bloom emissive', api: 'webgpu' } );
let camera, scene, renderer;
let renderPipeline;

init();

function init() {

	//

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( - 1.8, 0.6, 2.7 );

	scene = new THREE.Scene();

	new HDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'moonless_golf_1k.hdr', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.background = texture;
			scene.environment = texture;

			// model

			const loader = new GLTFLoader().setPath( 'models/gltf/DamagedHelmet/glTF/' );
			loader.load( 'DamagedHelmet.gltf', function ( gltf ) {

				scene.add( gltf.scene );

			} );

		} );

	//

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( render );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	//

	const scenePass = pass( scene, camera );

	// set up MRT with emissive

	const mrtNode = mrt( {
		output: output,
		emissive: vec4( emissive, output.a )
	} );

	mrtNode.setBlendMode( 'emissive', new THREE.BlendMode( THREE.NormalBlending ) );

	scenePass.setMRT( mrtNode );

	// optimize the bandwidth

	const emissiveTexture = scenePass.getTexture( 'emissive' );
	emissiveTexture.type = THREE.UnsignedByteType;

	//

	const outputPass = scenePass.getTextureNode();
	const emissivePass = scenePass.getTextureNode( 'emissive' );

	const bloomPass = bloom( emissivePass, 2.5, .5 );

	renderPipeline = new THREE.RenderPipeline( renderer );
	renderPipeline.outputNode = outputPass.add( bloomPass );

	//

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 2;
	controls.maxDistance = 10;
	controls.target.set( 0, 0, - 0.2 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

	//

	const gui = new GUI( { title: 'Settings' } );

	const bloomFolder = gui.addFolder( 'Bloom' );
	bloomFolder.add( bloomPass.strength, 'value', 0.0, 5.0 ).name( 'strength' );
	bloomFolder.add( bloomPass.radius, 'value', 0.0, 1.0 ).name( 'radius' );

	const toneMappingFolder = gui.addFolder( 'Tone Mapping' );
	toneMappingFolder.add( renderer, 'toneMappingExposure', 0.1, 2 ).name( 'exposure' );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function render() {

	renderPipeline.render();

}
