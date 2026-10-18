import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { assets, hasDisplay, require } from '../helpers.mjs';

export { hasDisplay };

export const KINDS = [
	{ name: 'WebGLRenderer', webgpu: false, bottomUp: true },
	{ name: 'WebGPURenderer (WebGPU)', webgpu: true, bottomUp: false },
	{ name: 'WebGPURenderer (WebGL2 fallback)', webgpu: false, forceWebGL: true, bottomUp: true },
];

export const createHarness = async ( kind, size = 64 ) => {

	const sdl = require( '@kmamal/sdl' );
	const THREE = await import( kind.webgpu || kind.forceWebGL ? '@kmamal/three/webgpu' : '@kmamal/three' );

	const title = `SDL test ${kind.name.replace( /[^A-Za-z0-9]+/g, ' ' ).trim()}`;
	const window = sdl.video.createWindow( {
		title,
		webgpu: kind.webgpu === true,
		opengl: kind.webgpu !== true,
		width: 200,
		height: 150,
		resizable: true,
	} );

	if ( process.env.I3SOCK ) {

		await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );
		spawnSync( 'i3-msg', [ `[title="${title}"] floating enable` ] );

	}

	let renderer;
	if ( kind.name === 'WebGLRenderer' ) {

		renderer = new THREE.WebGLRenderer( { window } );

	} else {

		renderer = new THREE.WebGPURenderer( { window, forceWebGL: kind.forceWebGL === true } );
		await renderer.init();

	}

	const createTarget = ( options ) => kind.name === 'WebGLRenderer' ? new THREE.WebGLRenderTarget( size, size, options ) : new THREE.RenderTarget( size, size, options );

	const readImage = async ( target ) => {

		let data;
		if ( kind.name === 'WebGLRenderer' ) {

			data = new Uint8Array( size * size * 4 );
			renderer.readRenderTargetPixels( target, 0, 0, size, size, data );

		} else {

			data = await renderer.readRenderTargetPixelsAsync( target, 0, 0, size, size );

		}

		const image = { width: size, height: size, data: new Uint8Array( size * size * 4 ) };
		for ( let row = 0; row < size; row ++ ) {

			const source = kind.bottomUp ? size - 1 - row : row;
			image.data.set( data.subarray( source * size * 4, ( source + 1 ) * size * 4 ), row * size * 4 );

		}

		return image;

	};

	const renderToImage = async ( scene, camera, options = {} ) => {

		const target = createTarget( options );
		renderer.setRenderTarget( target );
		renderer.render( scene, camera );
		renderer.setRenderTarget( null );
		const image = await readImage( target );
		target.dispose();
		return image;

	};

	const dispose = async () => {

		try {

			await renderer.dispose();

		} finally {

			window.destroy();

		}

	};

	return { THREE, window, renderer, size, createTarget, readImage, renderToImage, dispose };

};

export const quadrantsTexture = async ( THREE, options = {} ) => {

	const texture = await new THREE.TextureLoader().loadAsync( path.join( assets, 'quadrants.png' ) );
	texture.colorSpace = THREE.NoColorSpace;
	if ( options.flipY === false ) texture.flipY = false;
	return texture;

};

export const fullscreenQuad = ( THREE, material ) => {

	const scene = new THREE.Scene();
	const camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0.1, 10 );
	camera.position.z = 2;
	scene.add( new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), material ) );
	return { scene, camera };

};
