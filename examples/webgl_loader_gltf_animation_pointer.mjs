import * as THREE from '@kmamal/three';

import Stats from '@kmamal/three/addons/libs/stats.module.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from '@kmamal/three/addons/environments/RoomEnvironment.js';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';
import { DRACOLoader, DRACO_GLTF_CONFIG } from '@kmamal/three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from '@kmamal/three/addons/loaders/KTX2Loader.js';
import { GLTFAnimationPointerExtension } from '@needle-tools/three-animation-pointer';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgl - animation - keyframes', api: 'webgl' } );

let mixer;

const timer = new THREE.Timer();
timer.connect( document );
const stats = new Stats();

const renderer = new THREE.WebGLRenderer( { antialias: true, window: sdlWindow } );
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight );

const pmremGenerator = new THREE.PMREMGenerator( renderer );

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0xbfe3dd );
scene.environment = pmremGenerator.fromScene( new RoomEnvironment(), 0.04 ).texture;

const camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, .2, 100 );
camera.position.set( - 3, 2, 6 );

const controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.5, 0 );
controls.update();
controls.enablePan = false;
controls.enableDamping = true;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath( DRACO_GLTF_CONFIG );

const ktx2Loader = new KTX2Loader()
	.detectSupport( renderer );

const loader = new GLTFLoader();
loader.setDRACOLoader( dracoLoader );
loader.setKTX2Loader( ktx2Loader );

loader.register( p => {

	return new GLTFAnimationPointerExtension( p );

} );

loader.load( 'https://cloud.needle.tools/-/assets/Z23hmXB27L6Db-optimized/file', function ( gltf ) {

	const model = gltf.scene;
	scene.add( model );

	mixer = new THREE.AnimationMixer( model );
	mixer.clipAction( gltf.animations[ 0 ] ).play();

	renderer.setAnimationLoop( animate );

}, undefined, function ( e ) {

	console.error( e );

} );

window.onresize = function () {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

};

function animate() {

	timer.update();

	const delta = timer.getDelta();

	mixer.update( delta );

	controls.update();

	stats.update();

	renderer.render( scene, camera );

}
