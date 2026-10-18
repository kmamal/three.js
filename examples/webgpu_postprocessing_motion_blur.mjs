import * as THREE from '@kmamal/three/webgpu';
import { pass, texture, uniform, output, mrt, velocity, uv, screenUV, vec4 } from '@kmamal/three/tsl';
import { motionBlur } from '@kmamal/three/addons/tsl/display/MotionBlur.js';

import { GLTFLoader } from '@kmamal/three/addons/loaders/GLTFLoader.js';

import { OrbitControls } from '@kmamal/three/addons/controls/OrbitControls.js';

import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { createWindow, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindow = createWindow( { title: 'three.js webgpu - motion blur', api: 'webgpu' } );
let camera, scene, renderer;
let boxLeft, boxRight, model, mixer, timer;
let renderPipeline;
let controls;

const params = {
	speed: 1.0
};

init();

function init() {

	camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, 0.25, 30 );
	camera.position.set( 0, 1.5, 4.5 );

	scene = new THREE.Scene();
	scene.fog = new THREE.Fog( 0x0487e2, 7, 25 );

	const sunLight = new THREE.DirectionalLight( 0xFFE499, 5 );
	sunLight.castShadow = true;
	sunLight.shadow.camera.near = .1;
	sunLight.shadow.camera.far = 10;
	sunLight.shadow.camera.right = 2;
	sunLight.shadow.camera.left = - 2;
	sunLight.shadow.camera.top = 2;
	sunLight.shadow.camera.bottom = - 2;
	sunLight.shadow.mapSize.width = 1024;
	sunLight.shadow.mapSize.height = 1024;
	sunLight.position.set( 4, 4, 2 );

	const waterAmbientLight = new THREE.HemisphereLight( 0x333366, 0x74ccf4, 5 );
	const skyAmbientLight = new THREE.HemisphereLight( 0x74ccf4, 0, 1 );

	scene.add( sunLight );
	scene.add( skyAmbientLight );
	scene.add( waterAmbientLight );

	timer = new THREE.Timer();
	timer.connect( document );

	// animated model

	const loader = new GLTFLoader();
	loader.load( 'models/gltf/Xbot.glb', function ( gltf ) {

		model = gltf.scene;

		model.rotation.y = Math.PI / 2;

		model.traverse( function ( child ) {

			if ( child.isMesh ) {

				child.castShadow = true;
				child.receiveShadow = true;

			}

		} );

		mixer = new THREE.AnimationMixer( model );

		const action = mixer.clipAction( gltf.animations[ 3 ] );
		action.play();

		scene.add( model );

	} );

	// textures

	const textureLoader = new THREE.TextureLoader();

	const floorColor = textureLoader.load( 'textures/floors/FloorsCheckerboard_S_Diffuse.jpg' );
	floorColor.wrapS = THREE.RepeatWrapping;
	floorColor.wrapT = THREE.RepeatWrapping;
	floorColor.colorSpace = THREE.SRGBColorSpace;

	const floorNormal = textureLoader.load( 'textures/floors/FloorsCheckerboard_S_Normal.jpg' );
	floorNormal.wrapS = THREE.RepeatWrapping;
	floorNormal.wrapT = THREE.RepeatWrapping;

	// floor

	const floorUV = uv().mul( 5 );

	const floorMaterial = new THREE.MeshPhongNodeMaterial();
	floorMaterial.colorNode = texture( floorColor, floorUV );

	const floor = new THREE.Mesh( new THREE.BoxGeometry( 15, .001, 15 ), floorMaterial );
	floor.receiveShadow = true;

	floor.position.set( 0, 0, 0 );
	scene.add( floor );

	const walls = new THREE.Mesh( new THREE.BoxGeometry( 15, 15, 15 ), new THREE.MeshPhongNodeMaterial( { colorNode: floorMaterial.colorNode, side: THREE.BackSide } ) );
	scene.add( walls );

	const map = new THREE.TextureLoader().load( 'textures/uv_grid_opengl.jpg' );
	map.colorSpace = THREE.SRGBColorSpace;

	const geometry = new THREE.TorusGeometry( .8 );
	const material = new THREE.MeshBasicMaterial( { map } );

	boxRight = new THREE.Mesh( geometry, material );
	boxRight.position.set( 3.5, 1.5, - 4 );
	scene.add( boxRight );

	boxLeft = new THREE.Mesh( geometry, material );
	boxLeft.position.set( - 3.5, 1.5, - 4 );
	scene.add( boxLeft );

	// renderer

	renderer = new THREE.WebGPURenderer( { window: sdlWindow } );
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setAnimationLoop( animate );
	renderer.shadowMap.enabled = true;

	controls = new OrbitControls( camera, renderer.domElement );
	controls.minDistance = 1;
	controls.maxDistance = 10;
	controls.maxPolarAngle = Math.PI / 2;
	controls.autoRotate = true;
	controls.autoRotateSpeed = 1;
	controls.target.set( 0, 1, 0 );
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.update();

	// post-processing

	const blurAmount = uniform( 1 );

	const scenePass = pass( scene, camera );

	scenePass.setMRT( mrt( {
		output,
		velocity
	} ) );

	const beauty = scenePass.getTextureNode();
	const vel = scenePass.getTextureNode( 'velocity' ).mul( blurAmount );

	const mBlur = motionBlur( beauty, vel );

	const vignette = screenUV.distance( .5 ).remap( .6, 1 ).mul( 2 ).clamp().oneMinus();

	renderPipeline = new THREE.RenderPipeline( renderer );
	renderPipeline.outputNode = vec4( mBlur.mul( vignette ).rgb, mBlur.a );

	//

	const gui = new GUI( { title: 'Motion Blur Settings' } );
	gui.add( controls, 'autoRotate' );
	gui.add( blurAmount, 'value', 0, 3 ).name( 'blur amount' );
	gui.add( params, 'speed', 0, 2 );

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

	controls.update();

	const delta = timer.getDelta();
	const speed = params.speed;

	boxRight.rotation.y += delta * 4 * speed;
	boxLeft.scale.setScalar( 1 + Math.sin( timer.getElapsed() * 10 * speed ) * .2 );

	if ( model ) {

		mixer.update( delta * speed );

	}

	renderPipeline.render();

}
