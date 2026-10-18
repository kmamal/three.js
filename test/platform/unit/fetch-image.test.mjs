import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { sdlFetch } from '../../../src/platform/sdl/SDLFetch.js';
import { SDLImage } from '../../../src/platform/sdl/SDLImage.js';
import { assets, QUADRANTS, pixelAt } from '../helpers.mjs';

const png = path.join( assets, 'quadrants.png' );

const loadImage = ( source ) => new Promise( ( resolve, reject ) => {

	const image = new SDLImage();
	image.addEventListener( 'load', () => resolve( image ) );
	image.addEventListener( 'error', ( event ) => reject( event.error ) );
	image.src = source;

} );

describe( 'SDL fetch', () => {

	it( 'reads absolute paths, file URLs and relative paths', async () => {

		const expected = fs.readFileSync( png );
		for ( const source of [ png, pathToFileURL( png ).href, path.relative( process.cwd(), png ) ] ) {

			const response = await sdlFetch( source );
			assert.equal( response.status, 200 );
			assert.equal( response.headers.get( 'content-type' ), 'image/png' );
			assert.deepEqual( Buffer.from( await response.arrayBuffer() ), expected );

		}

	} );

	it( 'ignores query strings and fragments on local paths', async () => {

		const expected = fs.readFileSync( png );
		for ( const source of [ `${png}?0`, `${png}?cache=1#top`, `${pathToFileURL( png ).href}?1` ] ) {

			const response = await sdlFetch( source );
			assert.equal( response.status, 200 );
			assert.deepEqual( Buffer.from( await response.arrayBuffer() ), expected );

		}

	} );

	it( 'reads data URIs through the standard fetch', async () => {

		const response = await sdlFetch( `data:text/plain;base64,${Buffer.from( 'hello' ).toString( 'base64' )}` );
		assert.equal( await response.text(), 'hello' );

	} );

	it( 'answers 404 for missing files', async () => {

		const response = await sdlFetch( path.join( assets, 'missing.png' ) );
		assert.equal( response.status, 404 );

	} );

	it( 'guesses glTF and JSON content types', async () => {

		assert.equal( ( await sdlFetch( path.join( assets, 'quad.glb' ) ) ).headers.get( 'content-type' ), 'model/gltf-binary' );

	} );

} );

describe( 'SDL image decoding', () => {

	for ( const file of [ 'quadrants.png', 'quadrants.webp', 'quadrants.jpg' ] ) {

		it( `decodes ${file} to upright RGBA bytes`, async () => {

			const image = await loadImage( path.join( assets, file ) );
			assert.equal( image.width, 128 );
			assert.equal( image.height, 128 );
			assert.equal( image.complete, true );
			assert.equal( image.data.length, 128 * 128 * 4 );
			const tolerance = file.endsWith( 'jpg' ) ? 3 : 0;
			const sample = { topLeft: pixelAt( image, 32, 32 ), topRight: pixelAt( image, 96, 32 ), bottomLeft: pixelAt( image, 32, 96 ), bottomRight: pixelAt( image, 96, 96 ) };
			for ( const [ name, expected ] of Object.entries( QUADRANTS ) ) {

				sample[ name ].forEach( ( value, channel ) => assert.ok( Math.abs( value - expected[ channel ] ) <= tolerance, `${file} ${name} channel ${channel}: ${value} vs ${expected[ channel ]}` ) );

			}

		} );

	}

	it( 'decodes data URIs', async () => {

		const uri = `data:image/png;base64,${fs.readFileSync( png ).toString( 'base64' )}`;
		const image = await loadImage( uri );
		assert.equal( image.width, 128 );

	} );

	it( 'exposes natural size aliases', async () => {

		const image = await loadImage( png );
		assert.equal( image.naturalWidth, 128 );
		assert.equal( image.naturalHeight, 128 );

	} );

	it( 'fires an error event with a message for missing files', async () => {

		await assert.rejects( loadImage( path.join( assets, 'missing.png' ) ), /404/ );

	} );

	it( 'fires an error event for undecodable data', async () => {

		await assert.rejects( loadImage( `data:image/png;base64,${Buffer.from( 'not an image' ).toString( 'base64' )}` ) );

	} );

	it( 'ignores stale results when src changes mid-load', async () => {

		const image = new SDLImage();
		const loads = [];
		image.addEventListener( 'load', () => loads.push( image.src ) );
		image.src = path.join( assets, 'quadrants.jpg' );
		image.src = png;
		await new Promise( ( resolve ) => setTimeout( resolve, 500 ) );
		assert.deepEqual( loads, [ png ] );

	} );

} );
