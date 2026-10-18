import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SDLWorker } from '../../../src/platform/sdl/SDLWorker.js';

const root = path.resolve( import.meta.dirname, '../../..' );

const blobURL = ( source ) => URL.createObjectURL( new Blob( [ source ] ) );

const nextMessage = ( worker ) => new Promise( ( resolve, reject ) => {

	worker.addEventListener( 'message', ( event ) => resolve( event.data ), { once: true } );
	worker.addEventListener( 'error', ( event ) => reject( event.error ), { once: true } );

} );

describe( 'SDL worker shim', () => {

	const created = [];

	const spawn = ( source ) => {

		const worker = new SDLWorker( source );
		created.push( worker );
		return worker;

	};

	afterEach( () => {

		for ( const worker of created.splice( 0 ) ) worker.terminate();

	} );

	it( 'delivers messages posted before the thread has started', async () => {

		const worker = spawn( blobURL( 'self.onmessage = ( event ) => self.postMessage( { echo: event.data } );' ) );
		worker.postMessage( { hello: 'world' } );
		assert.deepEqual( await nextMessage( worker ), { echo: { hello: 'world' } } );

	} );

	it( 'supports addEventListener inside the worker', async () => {

		const worker = spawn( blobURL( 'self.addEventListener( "message", ( event ) => self.postMessage( event.data * 2 ) );' ) );
		worker.postMessage( 21 );
		assert.equal( await nextMessage( worker ), 42 );

	} );

	it( 'calls onmessage on the worker object', async () => {

		const worker = spawn( blobURL( 'self.onmessage = ( event ) => self.postMessage( "pong" );' ) );
		const received = new Promise( ( resolve ) => {

			worker.onmessage = ( event ) => resolve( event.data );

		} );
		worker.postMessage( 'ping' );
		assert.equal( await received, 'pong' );

	} );

	it( 'transfers array buffers in both directions', async () => {

		const worker = spawn( blobURL( 'self.onmessage = ( { data } ) => { const view = new Uint8Array( data ); view[ 0 ] = 99; self.postMessage( data, [ data ] ); };' ) );
		const buffer = new Uint8Array( [ 1, 2, 3 ] ).buffer;
		worker.postMessage( buffer, [ buffer ] );
		assert.equal( buffer.byteLength, 0 );
		const result = await nextMessage( worker );
		assert.deepEqual( Array.from( new Uint8Array( result ) ), [ 99, 2, 3 ] );

	} );

	it( 'loads the worker source from a file path', async () => {

		const file = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'sdl-worker-' ) ), 'worker.js' );
		fs.writeFileSync( file, 'self.onmessage = () => self.postMessage( "from file" );' );
		const worker = spawn( file );
		worker.postMessage( null );
		assert.equal( await nextMessage( worker ), 'from file' );

	} );

	it( 'reports exceptions thrown in the worker as error events', async () => {

		const worker = spawn( blobURL( 'throw new Error( "boom" );' ) );
		await assert.rejects( nextMessage( worker ), /boom/ );

	} );

	it( 'reports a missing source as an error event', async () => {

		const worker = spawn( path.join( os.tmpdir(), 'does-not-exist-worker.js' ) );
		await assert.rejects( nextMessage( worker ), /Failed to load worker/ );

	} );

	it( 'does not support importScripts', async () => {

		const worker = spawn( blobURL( 'try { importScripts( "x.js" ); } catch ( error ) { self.postMessage( error.message ); }' ) );
		assert.match( await nextMessage( worker ), /not supported/ );

	} );

	it( 'stops delivering messages after terminate', async () => {

		const worker = spawn( blobURL( 'self.onmessage = () => self.postMessage( "late" );' ) );
		const received = [];
		worker.addEventListener( 'message', ( event ) => received.push( event.data ) );
		worker.terminate();
		worker.postMessage( 'ignored' );
		await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );
		assert.deepEqual( received, [] );

	} );

} );

describe( 'worker based loaders', () => {

	let THREE;

	before( async () => {

		THREE = await import( '@kmamal/three' );

	} );

	it( 'DRACOLoader decodes a compressed mesh', async () => {

		const { DRACOLoader } = await import( '@kmamal/three/addons/loaders/DRACOLoader.js' );
		const loader = new DRACOLoader().setDecoderPath( path.join( root, 'examples/jsm/libs/draco/' ) );
		try {

			const geometry = await loader.loadAsync( path.join( root, 'examples/models/draco/bunny.drc' ) );
			assert.equal( geometry.attributes.position.count, 34834 );
			assert.equal( geometry.index.count, 208353 );
			geometry.computeBoundingBox();
			const size = geometry.boundingBox.getSize( new THREE.Vector3() );
			assert.ok( size.x > 0.1 && size.x < 0.2 );

		} finally {

			loader.dispose();

		}

	} );

	it( 'KTX2Loader transcodes a Basis texture to RGBA when no compressed formats exist', async () => {

		const { KTX2Loader } = await import( '@kmamal/three/addons/loaders/KTX2Loader.js' );
		const loader = new KTX2Loader()
			.setTranscoderPath( path.join( root, 'examples/jsm/libs/basis/' ) )
			.detectSupport( { extensions: { has: () => false } } );
		try {

			const texture = await loader.loadAsync( path.join( root, 'examples/textures/spiritedaway.ktx2' ) );
			assert.equal( texture.image.width, 496 );
			assert.equal( texture.image.height, 260 );
			assert.equal( texture.format, THREE.RGBAFormat );
			assert.equal( texture.mipmaps[ 0 ].data.length, 496 * 260 * 4 * 6 );
			assert.deepEqual( Array.from( texture.mipmaps[ 0 ].data.slice( 0, 4 ) ), [ 134, 110, 68, 255 ] );

		} finally {

			loader.dispose();

		}

	} );

	it( 'exposes the platform object to addons', () => {

		assert.equal( typeof THREE.platform.Worker, 'function' );

	} );

} );
