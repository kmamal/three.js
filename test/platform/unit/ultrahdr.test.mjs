import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { buildUltraHDR, expectedLinear } from '../fixtures/ultrahdr.mjs';

let THREE;
let UltraHDRLoader;

before( async () => {

	THREE = await import( '@kmamal/three' )
	;( { UltraHDRLoader } = await import( '@kmamal/three/addons/loaders/UltraHDRLoader.js' ) );

} );

const parse = ( buffer, type ) => new Promise( ( resolve, reject ) => {

	const loader = new UltraHDRLoader();
	if ( type !== undefined ) loader.setDataType( type );
	try {

		loader.parse( buffer, resolve );

	} catch ( error ) {

		reject( error );

	}

} );

const sample = ( result, x, y, channel = 0 ) => {

	const raw = result.data[ ( y * result.width + x ) * 4 + channel ];
	return result.data instanceof Uint16Array ? THREE.DataUtils.fromHalfFloat( raw ) : raw;

};

const close = ( actual, expected, tolerance, message ) => assert.ok( Math.abs( actual - expected ) <= tolerance, `${message ?? ''} got ${actual} expected ${expected}±${tolerance}` );

describe( 'UltraHDRLoader', () => {

	it( 'decodes both JPEGs and returns an HDR image of the SDR size', async () => {

		const result = await parse( await buildUltraHDR( { width: 64, height: 32 } ) );
		assert.equal( result.width, 64 );
		assert.equal( result.height, 32 );
		assert.equal( result.format, THREE.RGBAFormat );
		assert.equal( result.type, THREE.HalfFloatType );
		assert.ok( result.data instanceof Uint16Array );
		assert.equal( result.data.length, 64 * 32 * 4 );

	} );

	it( 'applies the gain map: no gain keeps the SDR value, full gain brightens it', async () => {

		const result = await parse( await buildUltraHDR( { sdr: [ 128, 128, 128 ], gainLeft: 0, gainRight: 255 } ) );
		const dark = sample( result, 8, 16 );
		const bright = sample( result, 56, 16 );
		close( dark, expectedLinear( 128, 0 ), 0.01, 'left half (no gain)' );
		close( bright, expectedLinear( 128, 255 ), 0.04, 'right half (full gain)' );
		assert.ok( bright > dark * 2.5, `the boosted half should be much brighter: ${bright} vs ${dark}` );

	} );

	it( 'interpolates intermediate gain values', async () => {

		const result = await parse( await buildUltraHDR( { gainLeft: 64, gainRight: 192 } ) );
		close( sample( result, 8, 16 ), expectedLinear( 128, 64 ), 0.02, 'quarter gain' );
		close( sample( result, 56, 16 ), expectedLinear( 128, 192 ), 0.03, 'three quarter gain' );

	} );

	it( 'follows the gain map range and capacity metadata', async () => {

		for ( const meta of [ { gainMapMax: 1 }, { gainMapMax: 3, hdrCapacityMax: 3 }, { gainMapMin: 0.5, gainMapMax: 2.5 }, { hdrCapacityMax: 4 } ] ) {

			const result = await parse( await buildUltraHDR( { meta, gainLeft: 255, gainRight: 255 } ) );
			close( sample( result, 16, 16 ), expectedLinear( 128, 255, meta ), 0.04, JSON.stringify( meta ) );

		}

	} );

	it( 'applies gamma and offsets from the metadata', async () => {

		const meta = { gamma: 2.2, offsetSDR: 0.5, offsetHDR: 0.25 };
		const result = await parse( await buildUltraHDR( { meta, gainLeft: 128, gainRight: 128 } ) );
		close( sample( result, 16, 16 ), expectedLinear( 128, 128, meta ), 0.03, 'gamma and offsets' );

	} );

	it( 'treats the three color channels independently', async () => {

		const result = await parse( await buildUltraHDR( { sdr: [ 200, 100, 30 ], gainLeft: 0, gainRight: 0 } ) );
		const channels = [ 0, 1, 2 ].map( ( channel ) => sample( result, 16, 16, channel ) );
		close( channels[ 0 ], expectedLinear( 200, 0 ), 0.02, 'red' );
		close( channels[ 1 ], expectedLinear( 100, 0 ), 0.01, 'green' );
		close( channels[ 2 ], expectedLinear( 30, 0 ), 0.01, 'blue' );
		assert.ok( channels[ 0 ] > channels[ 1 ] && channels[ 1 ] > channels[ 2 ] );

	} );

	it( 'writes opaque alpha', async () => {

		const result = await parse( await buildUltraHDR() );
		assert.equal( sample( result, 4, 4, 3 ), 1 );

	} );

	it( 'returns 32-bit floats when asked to', async () => {

		const result = await parse( await buildUltraHDR( { gainLeft: 255, gainRight: 255 } ), THREE.FloatType );
		assert.ok( result.data instanceof Float32Array );
		assert.equal( result.type, THREE.FloatType );
		close( result.data[ ( 16 * 64 + 16 ) * 4 ], expectedLinear( 128, 255 ), 0.04, 'float value' );

	} );

	it( 'reads MPF directories written in little-endian order', async () => {

		const result = await parse( await buildUltraHDR( { littleEndian: true, gainLeft: 0, gainRight: 255 } ) );
		close( sample( result, 56, 16 ), expectedLinear( 128, 255 ), 0.04, 'little-endian MPF' );

	} );

	it( 'upsamples a gain map that is smaller than the SDR image', async () => {

		const result = await parse( await buildUltraHDR( { width: 64, height: 32, gainWidth: 16, gainHeight: 8, gainLeft: 0, gainRight: 255 } ) );
		assert.equal( result.width, 64 );
		close( sample( result, 4, 16 ), expectedLinear( 128, 0 ), 0.02, 'left' );
		close( sample( result, 60, 16 ), expectedLinear( 128, 255 ), 0.05, 'right' );

	} );

	it( 'rejects a gain map whose aspect ratio does not match', async () => {

		const buffer = await buildUltraHDR( { width: 64, height: 32, gainWidth: 16, gainHeight: 16 } );
		const failure = new Promise( ( resolve ) => {

			const listeners = process.listeners( 'unhandledRejection' );
			process.removeAllListeners( 'unhandledRejection' );
			process.once( 'unhandledRejection', ( reason ) => {

				for ( const listener of listeners ) process.on( 'unhandledRejection', listener );
				resolve( reason );

			} );

		} );
		new UltraHDRLoader().parse( buffer, () => assert.fail( 'should not load' ) );
		const reason = await failure;
		assert.match( reason.message, /Aspect ratio mismatch/ );

	} );

	it( 'rejects an ordinary JPEG', async () => {

		const sharp = ( await import( 'node:module' ) ).createRequire( import.meta.url )( 'sharp' );
		const plain = await sharp( { create: { width: 8, height: 8, channels: 3, background: '#808080' } } ).jpeg().toBuffer();
		const buffer = plain.buffer.slice( plain.byteOffset, plain.byteOffset + plain.byteLength );
		await assert.rejects( parse( buffer ), /Not a valid UltraHDR image/ );

	} );

	it( 'load() fills a DataTexture from a file', async () => {

		const fs = await import( 'node:fs' );
		const os = await import( 'node:os' );
		const path = await import( 'node:path' );
		const file = path.join( fs.mkdtempSync( path.join( os.tmpdir(), 'uhdr-' ) ), 'image.jpg' );
		fs.writeFileSync( file, Buffer.from( await buildUltraHDR( { width: 32, height: 16 } ) ) );
		const texture = await new Promise( ( resolve, reject ) => new UltraHDRLoader().load( file, resolve, undefined, reject ) );
		assert.equal( texture.isDataTexture, true );
		assert.equal( texture.image.width, 32 );
		assert.equal( texture.image.height, 16 );
		assert.equal( texture.type, THREE.HalfFloatType );
		assert.equal( texture.colorSpace, THREE.LinearSRGBColorSpace );

	} );

} );
