import * as THREE from '@kmamal/three';

import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';

import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from '@kmamal/three/addons/libs/meshopt_decoder.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - GLTFloader + compressed', api: 'webgl' } );

let camera, scene, renderer;

init();
render();

function init() {

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
	camera.position.set( 0, 100, 0 );

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xbbbbbb );
	scene.environment = pmremGenerator.fromScene( environment, 0.04 ).texture;
	environment.dispose();

	const grid = new THREE.GridHelper( 500, 10, 0xffffff, 0xffffff );
	grid.material.opacity = 0.5;
	grid.material.depthWrite = false;
	grid.material.transparent = true;
	scene.add( grid );

	const ktx2Loader = new KTX2Loader()
		.detectSupport( renderer );

	const loader = new GLTFLoader().setPath( 'models/gltf/' );
	loader.setKTX2Loader( ktx2Loader );
	loader.setMeshoptDecoder( MeshoptDecoder );
	loader.load( 'coffeemat.glb', function ( gltf ) {

		// coffeemat.glb was produced from the source scene using gltfpack:
		// gltfpack -i coffeemat/scene.gltf -o coffeemat.glb -cc -tc
		// The resulting model uses EXT_meshopt_compression (for geometry) and KHR_texture_basisu (for texture compression using ETC1S/BasisLZ)

		gltf.scene.position.y = 8;

		scene.add( gltf.scene );

		render();

	} );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'change', render ); // use if there is no animation loop
	controls.minDistance = 400;
	controls.maxDistance = 1000;
	controls.target.set( 10, 90, - 16 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

	render();

}

//

function render() {

	renderer.render( scene, camera );

}
