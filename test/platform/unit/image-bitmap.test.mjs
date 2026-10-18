import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire( import.meta.url );
let THREE;
let file;

before( async () => {

	THREE = await import( '@kmamal/three' );
	const sharp = require( 'sharp' );
	const pixels = Buffer.from( [
		255, 0, 0, 255, 0, 255, 0, 128,
		0, 0, 255, 255, 255, 255, 255, 0,
	] );
	file = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'bitmap-' ) ), 'image.png' );
	await sharp( pixels, { raw: { width: 2, height: 2, channels: 4 } } ).png().toFile( file );

} );

const load = ( options ) => new Promise( ( resolve, reject ) => {

	const loader = new THREE.ImageBitmapLoader();
	if ( options ) loader.setOptions( options );
	loader.load( file, resolve, undefined, reject );

} );

describe( 'ImageBitmapLoader', () => {

	it( 'loads a file into an image bitmap', async () => {

		const bitmap = await load();
		assert.equal( THREE.platform.isImageBitmap( bitmap ), true );
		assert.equal( bitmap.width, 2 );
		assert.equal( bitmap.height, 2 );
		assert.deepEqual( [ ...bitmap.data.subarray( 0, 4 ) ], [ 255, 0, 0, 255 ] );

	} );

	it( 'flips rows with imageOrientation flipY', async () => {

		const bitmap = await load( { imageOrientation: 'flipY' } );
		assert.deepEqual( [ ...bitmap.data.subarray( 0, 4 ) ], [ 0, 0, 255, 255 ] );
		assert.deepEqual( [ ...bitmap.data.subarray( 8, 12 ) ], [ 255, 0, 0, 255 ] );

	} );

	it( 'premultiplies alpha only when asked', async () => {

		const plain = await load();
		assert.deepEqual( [ ...plain.data.subarray( 4, 8 ) ], [ 0, 255, 0, 128 ] );
		const premultiplied = await load( { premultiplyAlpha: 'premultiply' } );
		assert.deepEqual( [ ...premultiplied.data.subarray( 4, 8 ) ], [ 0, 128, 0, 128 ] );

	} );

	it( 'reports errors for missing files', async () => {

		await assert.rejects( new Promise( ( resolve, reject ) => new THREE.ImageBitmapLoader().load( '/nonexistent.png', resolve, undefined, reject ) ) );

	} );

	it( 'close() releases the pixels', async () => {

		const bitmap = await load();
		bitmap.close();
		assert.equal( bitmap.width, 0 );

	} );

	it( 'does not treat a bitmap as an HTML image', async () => {

		const bitmap = await load();
		assert.equal( THREE.platform.isImage( bitmap ), false );

	} );

} );
