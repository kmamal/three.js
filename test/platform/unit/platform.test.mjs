import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { platform, setPlatform } from '../../../src/platform/Platform.js';

describe( 'platform registry', () => {

	it( 'is backed by the SDL implementation', () => {

		assert.equal( typeof platform.createCanvas, 'function' );
		assert.equal( typeof platform.Worker, 'function' );
		assert.equal( platform.isImage( {} ), false );

	} );

	it( 'lets an implementation override fields and getters', () => {

		const original = Object.getOwnPropertyDescriptors( platform );
		try {

			const calls = [];
			setPlatform( { present: ( canvas ) => {

				calls.push( canvas );

			}, get gpu() {

				return 'fake-gpu';

			} } );
			assert.equal( platform.gpu, 'fake-gpu' );
			platform.present( 'canvas' );
			assert.deepEqual( calls, [ 'canvas' ] );
			assert.equal( typeof platform.Worker, 'function' );

		} finally {

			Object.defineProperties( platform, original );

		}

	} );

} );

describe( 'device pixel ratio', () => {

	const require = createRequire( import.meta.url );

	const stubDisplays = ( displays ) => {

		const { video } = require( '@kmamal/sdl' );
		const original = Object.getOwnPropertyDescriptor( video, 'displays' );
		Object.defineProperty( video, 'displays', { get: () => displays(), configurable: true } );
		return () => {

			if ( original ) Object.defineProperty( video, 'displays', original );
			else delete video.displays;

		};

	};

	it( 'comes from the scale of the first SDL display while there is no window', async () => {

		await import( '@kmamal/three' );
		let displays = [ { scale: 1.5 }, { scale: 2 } ];
		const restore = stubDisplays( () => displays );
		try {

			assert.equal( platform.devicePixelRatio, 1.5 );
			displays = [ { scale: 2 } ];
			assert.equal( platform.devicePixelRatio, 2 );
			displays = [ { scale: null } ];
			assert.equal( platform.devicePixelRatio, 1 );
			displays = [];
			assert.equal( platform.devicePixelRatio, 1 );

		} finally {

			restore();

		}

	} );

	it( 'follows the live display list instead of caching it', async () => {

		await import( '@kmamal/three' );
		let scale = 1;
		const restore = stubDisplays( () => [ { scale } ] );
		try {

			assert.equal( platform.devicePixelRatio, 1 );
			scale = 1.25;
			assert.equal( platform.devicePixelRatio, 1.25 );

		} finally {

			restore();

		}

	} );

	it( 'reads the real display list when nothing is stubbed', async () => {

		await import( '@kmamal/three' );
		const ratio = platform.devicePixelRatio;
		assert.equal( typeof ratio, 'number' );
		assert.ok( ratio >= 1 && ratio <= 4, `unexpected ratio ${ratio}` );

	} );

} );
