import * as THREE from '@kmamal/three';

import { HDRCubeTextureLoader } from '@kmamal/three/addons/loaders/HDRCubeTextureLoader.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - pmrem cubemap', api: 'webgl' } );

let camera, scene, renderer;

init();

async function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.25, 20 );
	camera.position.set( 0, 0, 8 );

	scene = new THREE.Scene();

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( render );
	renderer.toneMapping = THREE.ACESFilmicToneMapping;

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 2;
	controls.maxDistance = 10;
	controls.update();

	new HDRCubeTextureLoader()
		.setPath( './textures/cube/pisaHDR/' )
		.load( [ 'px.hdr', 'nx.hdr', 'py.hdr', 'ny.hdr', 'pz.hdr', 'nz.hdr' ], function ( map ) {

			const pmremGenerator = new THREE.PMREMGenerator( renderer );
			const envMap = pmremGenerator.fromCubemap( map ).texture;

			scene.background = envMap;
			scene.backgroundBlurriness = 0.5;

			pmremGenerator.dispose();

			const geometry = new THREE.SphereGeometry( 0.4, 64, 64 );

			for ( let i = 0; i < 6; i ++ ) {

				for ( let j = 0; j < 5; j ++ ) {

					const material = new THREE.MeshPhysicalMaterial( {
						roughness: i / 5,
						metalness: j / 4,
						envMap: envMap
					} );

					const mesh = new THREE.Mesh( geometry, material );
					mesh.position.x = i - 2.5;
					mesh.position.y = j - 2;
					scene.add( mesh );

				}

			}

		} );

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function render() {

	renderer.render( scene, camera );

}
