import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasDisplay, require } from '../helpers.mjs';
import { KINDS } from './harness.mjs';

describe( 'destroying the window right after a render', { skip: ! hasDisplay && 'needs a display and GPU' }, () => {

	for ( const kind of KINDS ) {

		it( `does not present to the destroyed window (${kind.name})`, async () => {

			const sdl = require( '@kmamal/sdl' );
			const THREE = await import( kind.webgpu || kind.forceWebGL ? '@kmamal/three/webgpu' : '@kmamal/three' );

			const window = sdl.video.createWindow( {
				visible: false,
				webgpu: kind.webgpu === true,
				opengl: kind.webgpu !== true,
				width: 64,
				height: 64,
			} );

			let renderer;
			if ( kind.name === 'WebGLRenderer' ) {

				renderer = new THREE.WebGLRenderer( { window } );

			} else {

				renderer = new THREE.WebGPURenderer( { window, forceWebGL: kind.forceWebGL === true } );
				await renderer.init();

			}

			const errors = [];
			const onError = ( error ) => errors.push( error );
			process.on( 'uncaughtException', onError );

			try {

				renderer.render( new THREE.Scene(), new THREE.PerspectiveCamera() );
				window.destroy();
				await new Promise( ( resolve ) => setTimeout( resolve, 50 ) );

			} finally {

				process.off( 'uncaughtException', onError );

			}

			assert.deepEqual( errors, [] );

			await renderer.dispose();

		} );

	}

} );
