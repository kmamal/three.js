import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - morph targets - sphere', api: 'webgl' } );

let camera, scene, renderer, timer;

let mesh;

let sign = 1;
const speed = 0.5;

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.2, 100 );
	camera.position.set( 0, 5, 5 );

	scene = new THREE.Scene();

	timer = new THREE.Timer();
	timer.connect( document );

	const light1 = new THREE.PointLight( 0xff2200, 50000 );
	light1.position.set( 100, 100, 100 );
	scene.add( light1 );

	const light2 = new THREE.PointLight( 0x22ff00, 10000 );
	light2.position.set( - 100, - 100, - 100 );
	scene.add( light2 );

	scene.add( new THREE.AmbientLight( 0x111111 ) );

	const loader = new GLTFLoader();
	loader.load( 'models/gltf/AnimatedMorphSphere/glTF/AnimatedMorphSphere.gltf', function ( gltf ) {

		mesh = gltf.scene.getObjectByName( 'AnimatedMorphSphere' );
		mesh.rotation.z = Math.PI / 2;
		scene.add( mesh );

		//

		const pointsMaterial = new THREE.PointsMaterial( {
			size: 10,
			sizeAttenuation: false,
			map: new THREE.TextureLoader().load( 'textures/sprites/disc.png' ),
			alphaTest: 0.5
		} );

		const points = new THREE.Points( mesh.geometry, pointsMaterial );
		points.morphTargetInfluences = mesh.morphTargetInfluences;
		points.morphTargetDictionary = mesh.morphTargetDictionary;
		mesh.add( points );

	} );

	//

	renderer = new THREE.WebGLRenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 20;

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	timer.update();
	render();

}

function render() {

	const delta = timer.getDelta();

	if ( mesh !== undefined ) {

		const step = delta * speed;

		mesh.rotation.y += step;

		mesh.morphTargetInfluences[ 1 ] = mesh.morphTargetInfluences[ 1 ] + step * sign;

		if ( mesh.morphTargetInfluences[ 1 ] <= 0 || mesh.morphTargetInfluences[ 1 ] >= 1 ) {

			sign *= - 1;

		}

	}

	renderer.render( scene, camera );

}
