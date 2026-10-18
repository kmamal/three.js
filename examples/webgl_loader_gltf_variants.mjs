import * as THREE from '@kmamal/three';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from '@kmamal/three/addons/loaders/HDRLoader.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - GLTFloader + variants', api: 'webgl' } );

let camera, scene, renderer;
let gui;

const state = { variant: 'midnight' };

init();
render();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( 2.5, 1.5, 3.0 );

	scene = new THREE.Scene();

	new HDRLoader()
		.setPath( 'textures/equirectangular/' )
		.load( 'quarry_01_1k.hdr', function ( texture ) {

			texture.mapping = THREE.EquirectangularReflectionMapping;

			scene.background = texture;
			scene.environment = texture;

			render();

			// model

			const loader = new GLTFLoader().setPath( 'models/gltf/MaterialsVariantsShoe/glTF/' );
			loader.load( 'MaterialsVariantsShoe.gltf', function ( gltf ) {

				gltf.scene.scale.set( 10.0, 10.0, 10.0 );

				scene.add( gltf.scene );

				// GUI
				gui = new GUI();

				// Details of the KHR_materials_variants extension used here can be found below
				// https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_variants
				const parser = gltf.parser;
				const variantsExtension = gltf.userData.gltfExtensions[ 'KHR_materials_variants' ];
				const variants = variantsExtension.variants.map( ( variant ) => variant.name );
				const variantsCtrl = gui.add( state, 'variant', variants ).name( 'Variant' );

				selectVariant( scene, parser, variantsExtension, state.variant );

				variantsCtrl.onChange( ( value ) => selectVariant( scene, parser, variantsExtension, value ) );

				render();

			} );

		} );

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.toneMappingExposure = 1;

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.addEventListener( 'change', render ); // use if there is no animation loop
	controls.minDistance = 2;
	controls.maxDistance = 10;
	controls.target.set( 0, 0.5, - 0.2 );
	controls.update();

	window.addEventListener( 'resize', onWindowResize );

}

function selectVariant( scene, parser, extension, variantName ) {

	const variantIndex = extension.variants.findIndex( ( v ) => v.name.includes( variantName ) );

	scene.traverse( async ( object ) => {

		if ( ! object.isMesh || ! object.userData.gltfExtensions ) return;

		const meshVariantDef = object.userData.gltfExtensions[ 'KHR_materials_variants' ];

		if ( ! meshVariantDef ) return;

		if ( ! object.userData.originalMaterial ) {

			object.userData.originalMaterial = object.material;

		}

		const mapping = meshVariantDef.mappings
			.find( ( mapping ) => mapping.variants.includes( variantIndex ) );

		if ( mapping ) {

			object.material = await parser.getDependency( 'material', mapping.material );
			parser.assignFinalMaterial( object );

		} else {

			object.material = object.userData.originalMaterial;

		}

		render();

	} );

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
