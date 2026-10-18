import * as THREE from '@kmamal/three/webgpu';
import { uniform, cubeTexture } from '@kmamal/three/tsl';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { TeapotGeometry } from '@kmamal/three/addons/geometries/TeapotGeometry.js';
import { createWindow, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - instance uniform', api: 'webgpu' } );

class InstanceUniformNode extends THREE.Node {

	constructor() {

		super( 'vec3' );

		this.updateType = THREE.NodeUpdateType.OBJECT;

		this.uniformNode = uniform( new THREE.Color() );

	}

	update( frame ) {

		const mesh = frame.object;

		const meshColor = mesh.color;

		this.uniformNode.value.copy( meshColor );

	}

	setup( /*builder*/ ) {

		return this.uniformNode;

	}

}

let camera, scene, renderer;
let controls;

const objects = [];

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 4000 );
	camera.position.set( 0, 200, 1200 );

	scene = new THREE.Scene();

	// Grid

	const helper = new THREE.GridHelper( 1000, 40, 0x303030, 0x303030 );
	helper.position.y = - 75;
	scene.add( helper );

	// CubeMap

	const path = 'textures/cube/SwedishRoyalCastle/';
	const format = '.jpg';
	const urls = [
		path + 'px' + format, path + 'nx' + format,
		path + 'py' + format, path + 'ny' + format,
		path + 'pz' + format, path + 'nz' + format
	];

	const cTexture = new THREE.CubeTextureLoader().load( urls );

	// Materials

	const instanceUniform = new InstanceUniformNode();
	const cubeTextureNode = cubeTexture( cTexture );

	const material = new THREE.MeshBasicNodeMaterial();
	material.colorNode = instanceUniform.add( cubeTextureNode );
	material.emissiveNode = instanceUniform.mul( cubeTextureNode );

	// Geometry

	const geometry = new TeapotGeometry( 50, 18 );

	for ( let i = 0, l = 12; i < l; i ++ ) {

		addMesh( geometry, material );

	}

	//

	renderer = new THREE.WebGPURenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );

	//

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 400;
	controls.maxDistance = 2000;

	//

	window.addEventListener( 'resize', onWindowResize );

}

function addMesh( geometry, material ) {

	const mesh = new THREE.Mesh( geometry, material );

	mesh.color = new THREE.Color( Math.random() * 0xffffff );

	mesh.position.x = ( objects.length % 4 ) * 200 - 300;
	mesh.position.z = Math.floor( objects.length / 4 ) * 200 - 200;

	mesh.rotation.x = Math.random() * 200 - 100;
	mesh.rotation.y = Math.random() * 200 - 100;
	mesh.rotation.z = Math.random() * 200 - 100;

	objects.push( mesh );

	scene.add( mesh );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

//

function animate() {

	for ( let i = 0, l = objects.length; i < l; i ++ ) {

		const object = objects[ i ];

		object.rotation.x += 0.01;
		object.rotation.y += 0.005;

	}

	renderer.render( scene, camera );

}
