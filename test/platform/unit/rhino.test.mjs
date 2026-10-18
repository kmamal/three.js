import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assets } from '../helpers.mjs';

const require = createRequire( import.meta.url );

const findLibrary = () => {

	if ( process.env.RHINO3DM_PATH ) return process.env.RHINO3DM_PATH;
	try {

		return path.dirname( require.resolve( 'rhino3dm/package.json' ) );

	} catch {

		return null;

	}

};

const library = findLibrary();
const skip = library === null && 'install rhino3dm (or set RHINO3DM_PATH) to run these tests';

describe( 'Rhino3dmLoader', { skip }, () => {

	let Rhino3dmLoader;
	let video;

	before( async () => {

		await import( '@kmamal/three' )
		;( { video } = require( '@kmamal/sdl' ) )
		;( { Rhino3dmLoader } = await import( '@kmamal/three/addons/loaders/3DMLoader.js' ) );

	} );

	const withDisplayScale = async ( scale, fn ) => {

		const original = Object.getOwnPropertyDescriptor( video, 'displays' );
		Object.defineProperty( video, 'displays', { get: () => [ { scale } ], configurable: true } );
		try {

			return await fn();

		} finally {

			if ( original ) Object.defineProperty( video, 'displays', original );
			else delete video.displays;

		}

	};

	const load = async ( file ) => {

		const loader = new Rhino3dmLoader();
		loader.setLibraryPath( `${library}/` );
		try {

			return await loader.loadAsync( path.join( assets, file ) );

		} finally {

			loader.dispose();

		}

	};

	const findSprite = ( object ) => {

		let sprite = null;
		object.traverse( ( child ) => {

			if ( child.isSprite ) sprite = child;

		} );
		return sprite;

	};

	it( 'decodes a model with the rhino3dm WASM library in a worker', async () => {

		const object = await load( 'textdot.3dm' );
		assert.ok( object.children.length >= 1 );

	} );

	it( 'turns a text dot into a sprite at its position', async () => {

		const sprite = findSprite( await load( 'textdot.3dm' ) );
		assert.ok( sprite, 'a TextDot becomes a Sprite' );
		assert.deepEqual( sprite.position.toArray(), [ 1, 2, 3 ] );
		assert.equal( sprite.material.map.isCanvasTexture, true );

	} );

	it( 'sizes the label canvas by the display scale', async () => {

		const size = async ( scale ) => {

			const sprite = findSprite( await withDisplayScale( scale, () => load( 'textdot.3dm' ) ) );
			const canvas = sprite.material.map.image;
			return { width: canvas.width, height: canvas.height, style: canvas.style };

		};

		const normal = await size( 1 );
		const doubled = await size( 2 );
		const fractional = await size( 1.5 );
		assert.ok( normal.width > 40 && normal.height > 20 );
		assert.ok( Math.abs( doubled.width - normal.width * 2 ) <= 2, `${doubled.width} vs ${normal.width * 2}` );
		assert.equal( doubled.height, normal.height * 2 );
		assert.ok( fractional.width > normal.width && fractional.width < doubled.width );
		assert.equal( doubled.style.width, normal.style.width, 'the logical size does not depend on the scale' );
		assert.equal( doubled.style.height, normal.style.height );

	} );

	it( 'draws the label text on the canvas', async () => {

		const sprite = findSprite( await load( 'textdot.3dm' ) );
		const canvas = sprite.material.map.image;
		const { data } = canvas.getContext( '2d' ).getImageData( 0, 0, canvas.width, canvas.height );
		let white = 0;
		for ( let i = 0; i < data.length; i += 4 ) if ( data[ i ] > 200 && data[ i + 1 ] > 200 && data[ i + 2 ] > 200 ) white ++;
		assert.ok( white > 30, `the glyphs are drawn in white, found ${white} pixels` );

	} );

	it( 'loads the sample logo model', async () => {

		const object = await load( '../../../examples/models/3dm/Rhino_Logo.3dm' );
		let meshes = 0;
		object.traverse( ( child ) => {

			if ( child.isMesh || child.isLine || child.isPoints ) meshes ++;

		} );
		assert.ok( meshes > 0, 'the logo has geometry' );
		assert.ok( fs.existsSync( path.join( assets, 'textdot.3dm' ) ) );

	} );

} );
