import * as THREE from '@kmamal/three/webgpu';

import { FontLoader } from '@kmamal/three/addons/loaders/FontLoader.js';
import { TextGeometry } from '@kmamal/three/addons/geometries/TextGeometry.js';
import { createWindow, viewOf, window } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = {
	normal: createWindow( { title: 'three.js webgpu - logarithmic depth buffer - normal z-buffer', api: 'webgpu' } ),
	logzbuf: createWindow( { title: 'three.js webgpu - logarithmic depth buffer - logarithmic z-buffer', api: 'webgpu' } )
};

// 1 micrometer to 100 billion light years in one scene, with 1 unit = 1 meter?  preposterous!  and yet...
const NEAR = 1e-6, FAR = 1e27;
const mouse = [ .5, .5 ];
let zoompos = - 100, minzoomspeed = .015;
let zoomspeed = minzoomspeed;

const objects = {};

// Generate a number of text labels, from 1µm in size up to 100,000,000 light years
// Try to use some descriptive real-world examples of objects at each scale

const labeldata = [
	{ size: .01, scale: 0.0001, label: 'microscopic (1µm)' }, // FIXME - triangulating text fails at this size, so we scale instead
	{ size: .01, scale: 0.1, label: 'minuscule (1mm)' },
	{ size: .01, scale: 1.0, label: 'tiny (1cm)' },
	{ size: 1, scale: 1.0, label: 'child-sized (1m)' },
	{ size: 10, scale: 1.0, label: 'tree-sized (10m)' },
	{ size: 100, scale: 1.0, label: 'building-sized (100m)' },
	{ size: 1000, scale: 1.0, label: 'medium (1km)' },
	{ size: 10000, scale: 1.0, label: 'city-sized (10km)' },
	{ size: 3400000, scale: 1.0, label: 'moon-sized (3,400 Km)' },
	{ size: 12000000, scale: 1.0, label: 'planet-sized (12,000 km)' },
	{ size: 1400000000, scale: 1.0, label: 'sun-sized (1,400,000 km)' },
	{ size: 7.47e12, scale: 1.0, label: 'solar system-sized (50Au)' },
	{ size: 9.4605284e15, scale: 1.0, label: 'gargantuan (1 light year)' },
	{ size: 3.08567758e16, scale: 1.0, label: 'ludicrous (1 parsec)' },
	{ size: 1e19, scale: 1.0, label: 'mind boggling (1000 light years)' }
];

init().then( animate );

async function init() {

	const loader = new FontLoader();
	const font = await loader.loadAsync( 'fonts/helvetiker_regular.typeface.json' );

	const scene = initScene( font );

	// Initialize two copies of the same scene, one with normal z-buffer and one with logarithmic z-buffer
	objects.normal = await initView( scene, 'normal', false );
	objects.logzbuf = await initView( scene, 'logzbuf', true );

}

async function initView( scene, name, logDepthBuf ) {

	const sdlWindow = sdlWindows[ name ];
	const view = viewOf( sdlWindow ).window;

	const camera = new THREE.PerspectiveCamera( 50, view.innerWidth / view.innerHeight, NEAR, FAR );
	scene.add( camera );

	const renderer = new THREE.WebGPURenderer( { antialias: true, logarithmicDepthBuffer: logDepthBuf, window: sdlWindow } );
	renderer.setPixelRatio( view.devicePixelRatio );
	renderer.setSize( view.innerWidth, view.innerHeight );

	await renderer.init();

	view.addEventListener( 'mousemove', ( ev ) => onMouseMove( ev, view ) );
	view.addEventListener( 'resize', () => onWindowResize( { renderer, camera, view } ) );
	view.addEventListener( 'wheel', onMouseWheel );

	return { renderer: renderer, scene: scene, camera: camera };

}

function initScene( font ) {

	const scene = new THREE.Scene();
	scene.background = new THREE.Color( 0x000000 );

	scene.add( new THREE.AmbientLight( 0x777777 ) );

	const light = new THREE.DirectionalLight( 0xffffff, 3 );
	light.position.set( 100, 100, 100 );
	scene.add( light );

	const materialargs = {
		color: 0xffffff,
		specular: 0x050505,
		shininess: 50,
		emissive: 0x000000
	};

	const geometry = new THREE.SphereGeometry( 0.5, 24, 12 );

	for ( let i = 0; i < labeldata.length; i ++ ) {

		const scale = labeldata[ i ].scale || 1;

		const labelgeo = new TextGeometry( labeldata[ i ].label, {
			font: font,
			size: labeldata[ i ].size,
			depth: labeldata[ i ].size / 2
		} );

		labelgeo.computeBoundingSphere();

		// center text
		labelgeo.translate( - labelgeo.boundingSphere.radius, 0, 0 );

		materialargs.color = new THREE.Color().setHSL( Math.random(), 0.5, 0.5 );

		const material = new THREE.MeshPhongMaterial( materialargs );

		const group = new THREE.Group();
		group.position.z = - labeldata[ i ].size * scale;
		scene.add( group );

		const textmesh = new THREE.Mesh( labelgeo, material );
		textmesh.scale.set( scale, scale, scale );
		textmesh.position.z = - labeldata[ i ].size * scale;
		textmesh.position.y = labeldata[ i ].size / 4 * scale;
		group.add( textmesh );

		const dotmesh = new THREE.Mesh( geometry, material );
		dotmesh.position.y = - labeldata[ i ].size / 4 * scale;
		dotmesh.scale.multiplyScalar( labeldata[ i ].size * scale );
		group.add( dotmesh );

	}

	return scene;

}

function animate() {

	window.requestAnimationFrame( animate );

	// Put some limits on zooming
	const minzoom = labeldata[ 0 ].size * labeldata[ 0 ].scale * 1;
	const maxzoom = labeldata[ labeldata.length - 1 ].size * labeldata[ labeldata.length - 1 ].scale * 100;
	let damping = ( Math.abs( zoomspeed ) > minzoomspeed ? .95 : 1.0 );

	// Zoom out faster the further out you go
	const zoom = THREE.MathUtils.clamp( Math.pow( Math.E, zoompos ), minzoom, maxzoom );
	zoompos = Math.log( zoom );

	// Slow down quickly at the zoom limits
	if ( ( zoom == minzoom && zoomspeed < 0 ) || ( zoom == maxzoom && zoomspeed > 0 ) ) {

		damping = .85;

	}

	zoompos += zoomspeed;
	zoomspeed *= damping;

	objects.normal.camera.position.x = Math.sin( .5 * Math.PI * ( mouse[ 0 ] - .5 ) ) * zoom;
	objects.normal.camera.position.y = Math.sin( .25 * Math.PI * ( mouse[ 1 ] - .5 ) ) * zoom;
	objects.normal.camera.position.z = Math.cos( .5 * Math.PI * ( mouse[ 0 ] - .5 ) ) * zoom;
	objects.normal.camera.lookAt( objects.normal.scene.position );

	// Clone camera settings across both scenes
	objects.logzbuf.camera.position.copy( objects.normal.camera.position );
	objects.logzbuf.camera.quaternion.copy( objects.normal.camera.quaternion );

	objects.normal.renderer.render( objects.normal.scene, objects.normal.camera );
	objects.logzbuf.renderer.render( objects.logzbuf.scene, objects.logzbuf.camera );

}

function onWindowResize( { renderer, camera, view } ) {

	renderer.setSize( view.innerWidth, view.innerHeight );
	camera.aspect = view.innerWidth / view.innerHeight;
	camera.updateProjectionMatrix();

}

function onMouseMove( ev, view ) {

	mouse[ 0 ] = ev.clientX / view.innerWidth;
	mouse[ 1 ] = ev.clientY / view.innerHeight;

}

function onMouseWheel( ev ) {

	const amount = ev.deltaY;
	if ( amount === 0 ) return;
	const dir = amount / Math.abs( amount );
	zoomspeed = dir / 10;

	// Slow down default zoom speed after user starts zooming, to give them more control
	minzoomspeed = 0.001;

}
