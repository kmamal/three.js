import * as THREE from '@kmamal/three/webgpu';
import { texture, parallaxUV, blendOverlay, uv, normalMap, uniform } from '@kmamal/three/tsl';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - parallax uv', api: 'webgpu' } );
let camera, scene, renderer;

let controls;

init();

async function init() {

	// scene

	scene = new THREE.Scene();

	// camera

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, .1, 100 );
	camera.position.set( 15, 7, 15 );

	// environment

	const environmentTexture = await new HDRLoader()
		.loadAsync( './textures/equirectangular/752-hdri-skies-com_1k.hdr' );

	environmentTexture.mapping = THREE.EquirectangularReflectionMapping;

	scene.environment = environmentTexture;
	scene.background = environmentTexture;
	scene.backgroundBlurriness = 0.4;

	// textures

	const loader = new THREE.TextureLoader();

	const topTexture = await loader.loadAsync( 'textures/ambientcg/Ice002_1K-JPG_Color.jpg' );
	topTexture.colorSpace = THREE.SRGBColorSpace;
	topTexture.wrapS = THREE.RepeatWrapping;
	topTexture.wrapT = THREE.RepeatWrapping;

	const roughnessTexture = await loader.loadAsync( 'textures/ambientcg/Ice002_1K-JPG_Roughness.jpg' );
	roughnessTexture.colorSpace = THREE.NoColorSpace;
	roughnessTexture.wrapS = THREE.RepeatWrapping;
	roughnessTexture.wrapT = THREE.RepeatWrapping;

	const normalTexture = await loader.loadAsync( 'textures/ambientcg/Ice002_1K-JPG_NormalGL.jpg' );
	normalTexture.colorSpace = THREE.NoColorSpace;
	normalTexture.wrapS = THREE.RepeatWrapping;
	normalTexture.wrapT = THREE.RepeatWrapping;

	const displaceTexture = await loader.loadAsync( 'textures/ambientcg/Ice002_1K-JPG_Displacement.jpg' );
	displaceTexture.colorSpace = THREE.NoColorSpace;
	displaceTexture.wrapS = THREE.RepeatWrapping;
	displaceTexture.wrapT = THREE.RepeatWrapping;

	//

	const bottomTexture = await loader.loadAsync( 'textures/ambientcg/Ice003_1K-JPG_Color.jpg' );
	bottomTexture.colorSpace = THREE.SRGBColorSpace;
	bottomTexture.wrapS = THREE.RepeatWrapping;
	bottomTexture.wrapT = THREE.RepeatWrapping;

	// parallax effect

	const scaleUV = uniform( 3 );
	const scaledUV = uv().mul( scaleUV );

	const parallaxScale = uniform( 0.5 ); // parallax scale
	const offsetUV = texture( displaceTexture, scaledUV ).mul( parallaxScale );

	const parallaxUVOffset = parallaxUV( scaledUV, offsetUV );
	const parallaxResult = texture( bottomTexture, parallaxUVOffset );

	const iceNode = blendOverlay( texture( topTexture, scaledUV ), parallaxResult );

	// material

	const material = new THREE.MeshStandardNodeMaterial();
	material.colorNode = iceNode.mul( 5 ); // increase the color intensity to 5 ( contrast )
	material.roughnessNode = texture( roughnessTexture, scaledUV );
	material.normalNode = normalMap( texture( normalTexture, scaledUV ) );
	material.metalness = 0;

	const geometry = new THREE.CircleGeometry( 25, 64 );

	const ground = new THREE.Mesh( geometry, material );
	ground.rotateX( - Math.PI / 2 );
	scene.add( ground );

	// renderer

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ReinhardToneMapping;
	renderer.toneMappingExposure = 6;

	// gui

	const gui = new GUI( { title: 'Scene' } );
	gui.add( scene, 'backgroundBlurriness', 0, 1 ).name( 'Background Blurriness' );
	gui.add( parallaxScale, 'value', .2, .5 ).name( 'Parallax Scale' );
	gui.add( scaleUV, 'value', 1, 5 ).name( 'UV Scale' );

	// controls

	controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 0, 0 );
	controls.maxDistance = 40;
	controls.minDistance = 10;
	controls.autoRotate = true;
	controls.autoRotateSpeed = - 1;
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

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
