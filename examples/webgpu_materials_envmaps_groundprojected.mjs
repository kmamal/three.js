import * as THREE from '@kmamal/three/webgpu';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';
import { getGroundProjectedNormal } from '@kmamal/three/addons/tsl/utils/GroundedSkybox.js';

import { cubeTexture, float } from '@kmamal/three/tsl';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'threejs webgpu - materials - ground projected environment mapping', api: 'webgpu' } );

const params = {
	height: 15,
	radius: 100,
	enabled: true,
};

let camera, scene, renderer;

init();

async function init() {

	camera = new THREE.PerspectiveCamera(
		40,
		window.innerWidth / window.innerHeight,
		1,
		1000
	);
	camera.position.set( - 20, 7, 20 );
	camera.lookAt( 0, 4, 0 );

	scene = new THREE.Scene();

	const hdrLoader = new HDRLoader();
	const envMap = await hdrLoader.loadAsync( 'textures/equirectangular/blouberg_sunrise_2_1k.hdr' );
	envMap.mapping = THREE.EquirectangularReflectionMapping;

	scene.environment = envMap;

	const dracoLoader = new DRACOLoader();
	dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

	const loader = new GLTFLoader();
	loader.setDRACOLoader( dracoLoader );

	const shadow = new THREE.TextureLoader().load( 'models/gltf/ferrari_ao.png' );

	loader.load( 'models/gltf/ferrari.glb', function ( gltf ) {

		const bodyMaterial = new THREE.MeshPhysicalMaterial( {
			color: 0x000000, metalness: 1.0, roughness: 0.8,
			clearcoat: 1.0, clearcoatRoughness: 0.2
		} );

		const detailsMaterial = new THREE.MeshStandardMaterial( {
			color: 0xffffff, metalness: 1.0, roughness: 0.5
		} );

		const glassMaterial = new THREE.MeshPhysicalMaterial( {
			color: 0xffffff, metalness: 0.25, roughness: 0, transmission: 1.0
		} );

		const carModel = gltf.scene.children[ 0 ];
		carModel.scale.multiplyScalar( 4 );
		carModel.rotation.y = Math.PI;

		carModel.getObjectByName( 'body' ).material = bodyMaterial;

		carModel.getObjectByName( 'rim_fl' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_fr' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_rr' ).material = detailsMaterial;
		carModel.getObjectByName( 'rim_rl' ).material = detailsMaterial;
		carModel.getObjectByName( 'trim' ).material = detailsMaterial;

		carModel.getObjectByName( 'glass' ).material = glassMaterial;

		// shadow
		const mesh = new THREE.Mesh(
			new THREE.PlaneGeometry( 0.655 * 4, 1.3 * 4 ),
			new THREE.MeshBasicMaterial( {
				map: shadow, blending: THREE.MultiplyBlending, toneMapped: false, transparent: true, premultipliedAlpha: true
			} )
		);
		mesh.rotation.x = - Math.PI / 2;
		carModel.add( mesh );

		scene.add( carModel );

	} );

	//

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	await renderer.init();

	// use a cube map to avoid visual artifacts at the skybox's poles

	const size = envMap.image.height;
	const cubeRenderTarget = new THREE.CubeRenderTarget( size );
	cubeRenderTarget.fromEquirectangularTexture( renderer, envMap );
	const cubeMap = cubeRenderTarget.texture;

	// grounded skybox

	const geometry = new THREE.IcosahedronGeometry( 1, 16 );
	const material = new THREE.MeshBasicNodeMaterial( { side: THREE.DoubleSide } );
	material.colorNode = cubeTexture( cubeMap, getGroundProjectedNormal( float( params.radius ), float( params.height ) ) );

	const skybox = new THREE.Mesh( geometry, material );
	skybox.scale.setScalar( params.radius );
	scene.add( skybox );

	//

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 2, 0 );
	controls.maxPolarAngle = THREE.MathUtils.degToRad( 90 );
	controls.maxDistance = 80;
	controls.minDistance = 20;
	controls.enablePan = false;
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI( { title: 'Parameters' } );
	gui.add( params, 'enabled' ).name( 'Grounded' ).onChange( function ( value ) {

		if ( value ) {

			scene.add( skybox );
			scene.background = null;

		} else {

			scene.remove( skybox );
			scene.background = scene.environment;

		}

	} );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	renderer.render( scene, camera );

}
