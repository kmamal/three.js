import * as THREE from '@kmamal/three/webgpu';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { RectAreaLightHelper } from '@kmamal/three/addons/helpers/RectAreaLightHelper.js';
import { RectAreaLightTexturesLib } from '@kmamal/three/addons/lights/RectAreaLightTexturesLib.js';

import { checker, uv } from '@kmamal/three/tsl';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - rect area light', api: 'webgpu' } );

let renderer, scene, camera;
let rectLight1, rectLight2, rectLight3;
let timer;

init();

function init() {

	THREE.RectAreaLightNode.setLTC( RectAreaLightTexturesLib.init() );

	timer = new THREE.Timer();

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animation );

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 1000 );
	camera.position.set( 0, 5, - 15 );

	scene = new THREE.Scene();

	rectLight1 = new THREE.RectAreaLight( 0xff0000, 5, 4, 10 );
	rectLight1.position.set( - 5, 6, 5 );
	scene.add( rectLight1 );

	rectLight2 = new THREE.RectAreaLight( 0x00ff00, 5, 4, 10 );
	rectLight2.position.set( 0, 6, 5 );
	scene.add( rectLight2 );

	rectLight3 = new THREE.RectAreaLight( 0x0000ff, 5, 4, 10 );
	rectLight3.position.set( 5, 6, 5 );
	scene.add( rectLight3 );

	scene.add( new RectAreaLightHelper( rectLight1 ) );
	scene.add( new RectAreaLightHelper( rectLight2 ) );
	scene.add( new RectAreaLightHelper( rectLight3 ) );

	const geoFloor = new THREE.BoxGeometry( 2000, 0.1, 2000 );
	const matStdFloor = new THREE.MeshStandardMaterial( { color: 0x444444 } );
	matStdFloor.roughnessNode = checker( uv().mul( 400 ) );
	const mshStdFloor = new THREE.Mesh( geoFloor, matStdFloor );
	scene.add( mshStdFloor );

	const geoKnot = new THREE.TorusKnotGeometry( 1.5, 0.5, 200, 16 );
	const matKnot = new THREE.MeshStandardMaterial( { color: 0xffffff, roughness: 0, metalness: 0 } );
	const meshKnot = new THREE.Mesh( geoKnot, matKnot );
	meshKnot.position.set( 0, 5.5, 0 );
	scene.add( meshKnot );

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.target.copy( meshKnot.position );
	controls.update();

	//

	window.addEventListener( 'resize', onWindowResize );

}

function onWindowResize() {

	renderer.setSize( window.innerWidth, window.innerHeight );
	camera.aspect = ( window.innerWidth / window.innerHeight );
	camera.updateProjectionMatrix();

}

function animation() {

	timer.update();

	const delta = timer.getDelta();

	rectLight1.rotation.y += - delta;
	rectLight2.rotation.y += delta * .5;
	rectLight3.rotation.y += delta;

	renderer.render( scene, camera );

}
