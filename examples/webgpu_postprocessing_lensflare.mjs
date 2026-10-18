import * as THREE from '@kmamal/three/webgpu';
import { pass, mrt, output, emissive, uniform, texture } from '@kmamal/three/tsl';
import { bloom } from '@kmamal/three/addons/tsl/display/BloomNode.js';
import { lensflare } from '@kmamal/three/addons/tsl/display/LensflareNode.js';
import { gaussianBlur } from '@kmamal/three/addons/tsl/display/GaussianBlurNode.js';
import { lensDirt } from '@kmamal/three/addons/tsl/display/lensDirt.js';

import { UltraHDRLoader } from '@kmamal/three/addons/loaders/UltraHDRLoader.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - postprocessing lensflares', api: 'webgpu' } );
let camera, scene, renderer, controls;
let renderPipeline;

init();

async function init() {

	//

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 0, 0.5, - 0.5 );

	scene = new THREE.Scene();

	const envMap = await new UltraHDRLoader().loadAsync( 'textures/equirectangular/ice_planet_close.jpg' );

	envMap.mapping = THREE.EquirectangularReflectionMapping;

	scene.background = envMap;
	scene.environment = envMap;

	scene.backgroundIntensity = 2;
	scene.environmentIntensity = 15;

	// model

	const loader = new GLTFLoader();
	const gltf = await loader.loadAsync( 'models/gltf/space_ship_hallway.glb' );

	const object = gltf.scene;

	const aabb = new THREE.Box3().setFromObject( object );
	const center = aabb.getCenter( new THREE.Vector3() );

	object.position.x += ( object.position.x - center.x );
	object.position.y += ( object.position.y - center.y );
	object.position.z += ( object.position.z - center.z );

	scene.add( object );

	//

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( render );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	//

	const scenePass = pass( scene, camera );
	scenePass.setMRT( mrt( {
		output,
		emissive
	} ) );

	const outputPass = scenePass.getTextureNode();
	const emissivePass = scenePass.getTextureNode( 'emissive' );

	const bloomPass = bloom( emissivePass, 1, 1 );

	// flares

	const threshold = uniform( 0.5 );
	const ghostAttenuationFactor = uniform( 25 );
	const ghostSpacing = uniform( 0.25 );

	const flarePass = lensflare( bloomPass, {
		threshold,
		ghostAttenuationFactor,
		ghostSpacing
	} );

	const blurPass = gaussianBlur( flarePass, 8 ); // optional (blurring produces better flare quality but also adds some overhead)

	// dirt

	const lensDirtMap = new THREE.TextureLoader().load( 'textures/lensdirt.png' );
	const lensDirtIntensity = uniform( 3 );

	const dirtPass = lensDirt( bloomPass, texture( lensDirtMap ), lensDirtIntensity );

	//

	renderPipeline = new THREE.RenderPipeline( renderer );

	const params = {
		lensEffect: 'flares'
	};

	function updateOutput() {

		if ( params.lensEffect === 'flares' ) {

			renderPipeline.outputNode = outputPass.add( bloomPass ).add( blurPass );

			lensflareFolder.show();
			lensDirtFolder.hide();

		} else {

			renderPipeline.outputNode = outputPass.add( bloomPass ).add( dirtPass );

			lensflareFolder.hide();
			lensDirtFolder.show();

		}

		renderPipeline.needsUpdate = true;

	}

	//

	controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.enablePan = false;
	controls.enableZoom = false;
	controls.target.copy( camera.position );
	controls.target.z -= 0.01;
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

	//

	const gui = new GUI( { title: 'Settings' } );

	const bloomFolder = gui.addFolder( 'bloom' );
	bloomFolder.add( bloomPass.strength, 'value', 0.0, 2.0 ).name( 'strength' );
	bloomFolder.add( bloomPass.radius, 'value', 0.0, 1.0 ).name( 'radius' );

	gui.add( params, 'lensEffect', [ 'flares', 'dirt' ] ).name( 'lens effect' ).onChange( updateOutput );

	const lensflareFolder = gui.addFolder( 'lensflare' );
	lensflareFolder.add( threshold, 'value', 0.0, 1.0 ).name( 'threshold' );
	lensflareFolder.add( ghostAttenuationFactor, 'value', 10.0, 50.0 ).name( 'attenuation' );
	lensflareFolder.add( ghostSpacing, 'value', 0.0, 0.3 ).name( 'spacing' );

	const lensDirtFolder = gui.addFolder( 'lens dirt' );
	lensDirtFolder.add( lensDirtIntensity, 'value', 0.0, 10.0 ).name( 'intensity' );

	updateOutput();

	const toneMappingFolder = gui.addFolder( 'tone mapping' );
	toneMappingFolder.add( renderer, 'toneMappingExposure', 0.1, 2 ).name( 'exposure' );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function render() {

	controls.update();

	renderPipeline.render();

}
