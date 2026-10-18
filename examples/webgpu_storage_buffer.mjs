import * as THREE from '@kmamal/three/webgpu';
import { storage, If, vec3, uv, uint, float, Fn, instanceIndex, workgroupBarrier } from '@kmamal/three/tsl';
import { createWindow, viewOf } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = {
	webgpu: createWindow( { title: 'three.js webgpu - storage pbo external element - webgpu', api: 'webgpu' } ),
	webgl: createWindow( { title: 'three.js webgpu - storage pbo external element - webgl', api: 'webgl' } )
};

// WebGPU Backend
init();

// WebGL Backend
init( true );

async function init( forceWebGL = false ) {

	const sdlWindow = sdlWindows[ forceWebGL ? 'webgl' : 'webgpu' ];
	const view = viewOf( sdlWindow ).window;

	const aspect = view.innerWidth / view.innerHeight;
	const camera = new THREE.OrthographicCamera( - aspect, aspect, 1, - 1, 0, 2 );
	camera.position.z = 1;

	const scene = new THREE.Scene();

	// texture

	const size = 32; // non power of two buffer size is not well supported in WebGPU
	const barCount = 32;

	const type = [ 'float', 'vec2', 'vec3', 'vec4' ];

	const arrayBufferNodes = [];

	for ( let i = 0; i < type.length; i ++ ) {

		const typeSize = i + 1;
		const array = new Array( size * typeSize ).fill( 0 );

		const arrayBuffer = new THREE.StorageInstancedBufferAttribute( new Float32Array( array ), typeSize );

		arrayBufferNodes.push( storage( arrayBuffer, type[ i ], size ).setPBO( true ) );

	}

	const computeInitOrder = Fn( () => {

		for ( let i = 0; i < type.length; i ++ ) {

			arrayBufferNodes[ i ].element( instanceIndex ).assign( instanceIndex );

		}

	} );

	const computeInvertOrder = Fn( () => {

		for ( let i = 0; i < type.length; i ++ ) {

			const invertIndex = arrayBufferNodes[ i ].element( uint( size - 1 ).sub( instanceIndex ) ).toVar();
			workgroupBarrier();
			arrayBufferNodes[ i ].element( instanceIndex ).assign( invertIndex );

		}

	} );

	// compute

	const computeInit = computeInitOrder().compute( size );

	const compute = computeInvertOrder().compute( size );

	const material = new THREE.MeshBasicNodeMaterial( { color: 0x00ff00 } );

	material.colorNode = Fn( () => {

		const index = uint( uv().x.mul( size ).floor() ).toVar();

		If( index.greaterThanEqual( size ), () => {

			index.assign( uint( size ).sub( 1 ) );

		} );

		const color = vec3( 0, 0, 0 ).toVar();

		If( uv().y.greaterThan( 0.0 ), () => {

			const indexValue = arrayBufferNodes[ 0 ].element( index ).toVar();
			const value = float( indexValue ).div( float( size ) ).mul( barCount ).floor().div( barCount );

			color.assign( vec3( value, 0, 0 ) );

		} );

		If( uv().y.greaterThan( 0.25 ), () => {

			const indexValue = arrayBufferNodes[ 1 ].element( index ).toVar();
			const value = float( indexValue ).div( float( size ) ).mul( barCount ).floor().div( barCount );

			color.assign( vec3( 0, value, 0 ) );

		} );

		If( uv().y.greaterThan( 0.5 ), () => {

			const indexValue = arrayBufferNodes[ 2 ].element( index ).toVar();
			const value = float( indexValue ).div( float( size ) ).mul( barCount ).floor().div( barCount );

			color.assign( vec3( 0, 0, value ) );

		} );

		If( uv().y.greaterThan( 0.75 ), () => {

			const indexValue = arrayBufferNodes[ 3 ].element( index ).toVar();
			const value = float( indexValue ).div( float( size ) ).mul( barCount ).floor().div( barCount );

			color.assign( vec3( value, value, value ) );

		} );

		return color;

	} )();

	//

	const plane = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), material );
	scene.add( plane );

	const renderer = new THREE.WebGPURenderer( { antialias: false, forceWebGL: forceWebGL, trackTimestamp: true, window: sdlWindow } );
	renderer.setPixelRatio( view.devicePixelRatio );
	renderer.setSize( view.innerWidth, view.innerHeight );

	await renderer.init();

	if ( forceWebGL ) {

		scene.background = new THREE.Color( 0x212121 );

	} else {

		scene.background = new THREE.Color( 0x313131 );

	}

	renderer.compute( computeInit );

	//

	renderer.info.autoReset = false;

	 const stepAnimation = async function () {

		renderer.info.reset();

		renderer.compute( compute );
		renderer.render( scene, camera );

		renderer.resolveTimestampsAsync( THREE.TimestampQuery.COMPUTE );
		renderer.resolveTimestampsAsync( THREE.TimestampQuery.RENDER );

		sdlWindow.setTitle( `three.js webgpu - storage pbo external element - ${ forceWebGL ? 'webgl' : 'webgpu' } - compute ${renderer.info.compute.frameCalls} pass in ${renderer.info.compute.timestamp.toFixed( 6 )}ms, draw ${renderer.info.render.drawCalls} pass in ${renderer.info.render.timestamp.toFixed( 6 )}ms` );

		setTimeout( stepAnimation, 1000 );

	};

	stepAnimation();

	view.addEventListener( 'resize', onWindowResize );

	function onWindowResize() {

		renderer.setSize( view.innerWidth, view.innerHeight );

		const aspect = view.innerWidth / view.innerHeight;

		const frustumHeight = camera.top - camera.bottom;

		camera.left = - frustumHeight * aspect / 2;
		camera.right = frustumHeight * aspect / 2;

		camera.updateProjectionMatrix();

		renderer.render( scene, camera );

	}

}
