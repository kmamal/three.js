import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from '@kmamal/three/addons/libs/meshopt_decoder.module.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - morph face targets', api: 'webgpu' } );
init();

async function init() {

	let mixer;

	const timer = new THREE.Timer();
	timer.connect( document );

	const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 20 );
	camera.position.set( - 1.8, 0.8, 3 );

	const scene = new THREE.Scene();

	const renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	await renderer.init();

	const environment = new RoomEnvironment();
	const pmremGenerator = new THREE.PMREMGenerator( renderer );

	scene.background = new THREE.Color( 0x666666 );
	scene.environment = pmremGenerator.fromScene( environment, 0.04 ).texture;

	const ktx2Loader = await new KTX2Loader()
		.detectSupport( renderer );

	new GLTFLoader()
		.setKTX2Loader( ktx2Loader )
		.setMeshoptDecoder( MeshoptDecoder )
		.load( 'models/gltf/facecap.glb', ( gltf ) => {

			const mesh = gltf.scene.children[ 0 ];

			scene.add( mesh );

			mixer = new THREE.AnimationMixer( mesh );

			mixer.clipAction( gltf.animations[ 0 ] ).play();

			// GUI

			const head = mesh.getObjectByName( 'mesh_2' );
			const influences = head.morphTargetInfluences;

			const gui = new GUI( { title: 'Morph Targets' } );

			for ( const [ key, value ] of Object.entries( head.morphTargetDictionary ) ) {

				gui.add( influences, value, 0, 1, 0.01 )
					.name( key.replace( 'blendShape1.', '' ) )
					.listen();

			}

		} );

	scene.background = new THREE.Color( 0x666666 );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.enableDamping = true;
	controls.minDistance = 2.5;
	controls.maxDistance = 5;
	controls.minAzimuthAngle = - Math.PI / 2;
	controls.maxAzimuthAngle = Math.PI / 2;
	controls.maxPolarAngle = Math.PI / 1.8;
	controls.target.set( 0, 0.15, - 0.2 );

	function animate() {

		timer.update();

		const delta = timer.getDelta();

		if ( mixer ) {

			mixer.update( delta );

		}

		renderer.render( scene, camera );

		controls.update();

	}

	window.addEventListener( 'resize', () => {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	} );

}
