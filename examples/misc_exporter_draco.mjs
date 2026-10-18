import * as THREE from '@kmamal/three';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { DRACOExporter } from '@kmamal/three/addons/exporters/DRACOExporter.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, saveFile, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - exporter - draco', api: 'webgl' } );

let scene, camera, renderer, exporter, mesh;

const params = {
	export: exportFile
};

init();

function init() {

	camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 100 );
	camera.position.set( 4, 2, 4 );

	scene = new THREE.Scene();
	scene.background = new THREE.Color( 0xa0a0a0 );
	scene.fog = new THREE.Fog( 0xa0a0a0, 4, 20 );

	exporter = new DRACOExporter();

	//

	const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x444444, 3 );
	hemiLight.position.set( 0, 20, 0 );
	scene.add( hemiLight );

	const directionalLight = new THREE.DirectionalLight( 0xffffff, 3 );
	directionalLight.position.set( 0, 20, 10 );
	directionalLight.castShadow = true;
	directionalLight.shadow.camera.top = 2;
	directionalLight.shadow.camera.bottom = - 2;
	directionalLight.shadow.camera.left = - 2;
	directionalLight.shadow.camera.right = 2;
	scene.add( directionalLight );

	// ground

	const ground = new THREE.Mesh( new THREE.PlaneGeometry( 40, 40 ), new THREE.MeshPhongMaterial( { color: 0xbbbbbb, depthWrite: false } ) );
	ground.rotation.x = - Math.PI / 2;
	ground.receiveShadow = true;
	scene.add( ground );

	const grid = new THREE.GridHelper( 40, 20, 0x000000, 0x000000 );
	grid.material.opacity = 0.2;
	grid.material.transparent = true;
	scene.add( grid );

	// export mesh

	const geometry = new THREE.TorusKnotGeometry( 0.75, 0.2, 200, 30 );
	const material = new THREE.MeshPhongMaterial( { color: 0x00ff00 } );
	mesh = new THREE.Mesh( geometry, material );
	mesh.castShadow = true;
	mesh.position.y = 1.5;
	scene.add( mesh );

	//

	renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.shadowMap.enabled = true;

	//

	const controls = new OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, 1.5, 0 );
	controls.update();

	//

	window.addEventListener( 'resize', onWindowResize );

	const gui = new GUI();

	gui.add( params, 'export' ).name( 'Export DRC' );
	gui.open();

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate() {

	renderer.render( scene, camera );

}

async function exportFile() {

	const result = await exporter.parseAsync( mesh );
	saveArrayBuffer( result, 'file.drc' );

}

function save( blob, filename ) {

	saveFile( blob, filename );

}

function saveArrayBuffer( buffer, filename ) {

	save( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename );

}
