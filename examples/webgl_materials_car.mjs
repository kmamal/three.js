import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - materials - car', api: 'webgl' } );

let camera, scene, renderer;
let stats;

let grid;
let controls;

const wheels = [];

function init() {

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 0.85;

	window.addEventListener( 'resize', onWindowResize );

	stats = new Stats();

	//

	camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 4.25, 1.4, - 4.5 );

	controls = new OrbitControls( camera, renderer.domElement );
	controls.maxDistance = 9;
	controls.maxPolarAngle = THREE.MathUtils.degToRad( 90 );
	controls.target.set( 0, 0.5, 0 );
	controls.update();

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x333333 );
	scene.environment = new HDRLoader().load( 'textures/equirectangular/venice_sunset_1k.hdr' );
	scene.environment.mapping = THREE.EquirectangularReflectionMapping;
	scene.fog = new THREE.Fog( 0x333333, 10, 15 );

	grid = new THREE.GridHelper( 20, 40, 0xffffff, 0xffffff );
	grid.material.opacity = 0.2;
	grid.material.depthWrite = false;
	grid.material.transparent = true;
	scene.add( grid );

	// materials

	const bodyMaterial = new THREE.MeshPhysicalMaterial( {
		color: 0xff0000, metalness: 1.0, roughness: 0.5, clearcoat: 1.0, clearcoatRoughness: 0.03
	} );

	const detailsMaterial = new THREE.MeshStandardMaterial( {
		color: 0xffffff, metalness: 1.0, roughness: 0.5
	} );

	const glassMaterial = new THREE.MeshPhysicalMaterial( {
		color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1.0
	} );

	const bodyColorInput = document.getElementById( 'body-color' );
	bodyColorInput.addEventListener( 'input', function () {

		bodyMaterial.color.set( this.value );

	} );

	const detailsColorInput = document.getElementById( 'details-color' );
	detailsColorInput.addEventListener( 'input', function () {

		detailsMaterial.color.set( this.value );

	} );

	const glassColorInput = document.getElementById( 'glass-color' );
	glassColorInput.addEventListener( 'input', function () {

		glassMaterial.color.set( this.value );

	} );

	// Car

	const shadow = new THREE.TextureLoader().load( 'models/gltf/ferrari_ao.png' );

	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

	const loader = new GLTFLoader();
	loader.setDRACOLoader( dracoLoader );

	loader.load( 'models/gltf/ferrari.glb', function ( gltf ) {

		const carModel = gltf.scene.children[ 0 ];

		carModel.getObjectByName( 'body' ).material = bodyMaterial;

		carModel.getObjectByName( 'rim_fl' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_fr' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_rr' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_rl' ).material = detailsMaterial;
		carModel.getObjectByName( 'trim' ).material = detailsMaterial;

		carModel.getObjectByName( 'glass' ).material = glassMaterial;

		wheels.push(
			carModel.getObjectByName( 'wheel_fl' ),
			carModel.getObjectByName( 'wheel_fr' ),
			carModel.getObjectByName( 'wheel_rl' ),
			carModel.getObjectByName( 'wheel_rr' )
		);

		// shadow
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry( 0.655 * 4, 1.3 * 4 ),
			new THREE.MeshBasicMaterial( {
				map: shadow, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true
			} )
		);
		mesh.rotation.x = - Math.PI / 2;
		mesh.renderOrder = 2;
		carModel.add( mesh );

		scene.add( carModel );

	} );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	controls.update();

	const time = - performance.now() / 1000;

	for ( let i = 0; i < wheels.length; i ++ ) {

		wheels[ i ].rotation.x = time * Math.PI * 2;

	}

	grid.position.z = - ( time ) % 1;

	renderer.render( scene, camera );

	stats.update();

}

init();
