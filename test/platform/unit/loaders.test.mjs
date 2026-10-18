import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assets, QUADRANTS, pixelAt } from '../helpers.mjs';

let THREE;

before( async () => {

	THREE = await import( '@kmamal/three' );

} );

describe( 'stock loaders on the SDL platform', () => {

	it( 'TextureLoader loads a local file into a Texture', async () => {

		const texture = await new THREE.TextureLoader().loadAsync( path.join( assets, 'quadrants.png' ) );
		assert.equal( texture.isTexture, true );
		assert.equal( texture.image.width, 128 );
		assert.equal( texture.image.height, 128 );
		assert.deepEqual( pixelAt( texture.image, 32, 32 ), QUADRANTS.topLeft );
		assert.deepEqual( pixelAt( texture.image, 96, 96 ), QUADRANTS.bottomRight );

	} );

	it( 'TextureLoader resolves paths through setPath', async () => {

		const loader = new THREE.TextureLoader().setPath( `${assets}/` );
		const texture = await loader.loadAsync( 'quadrants.webp' );
		assert.equal( texture.image.width, 128 );

	} );

	it( 'TextureLoader rejects missing files', async () => {

		await assert.rejects( new THREE.TextureLoader().loadAsync( path.join( assets, 'missing.png' ) ) );

	} );

	it( 'ImageLoader returns the cached image when the cache is enabled', async () => {

		THREE.Cache.enabled = true;
		try {

			const loader = new THREE.ImageLoader();
			const source = path.join( assets, 'quadrants.jpg' );
			const first = await loader.loadAsync( source );
			const second = await loader.loadAsync( source );
			assert.equal( first, second );

		} finally {

			THREE.Cache.clear();
			THREE.Cache.enabled = false;

		}

	} );

	it( 'CubeTextureLoader loads six faces', async () => {

		const faces = Array( 6 ).fill( path.join( assets, 'quadrants.png' ) );
		const cube = await new THREE.CubeTextureLoader().loadAsync( faces );
		assert.equal( cube.image.length, 6 );
		assert.equal( cube.image[ 5 ].width, 128 );

	} );

	it( 'FileLoader reads text and array buffers from disk', async () => {

		const file = path.join( assets, 'quadrants.png' );
		const loader = new THREE.FileLoader();
		loader.setResponseType( 'arraybuffer' );
		const buffer = await loader.loadAsync( file );
		assert.equal( buffer.byteLength, fs.statSync( file ).size );
		const packageText = await new THREE.FileLoader().loadAsync( path.join( import.meta.dirname, '../../../package.json' ) );
		assert.equal( JSON.parse( packageText ).name, '@kmamal/three' );

	} );

	it( 'FileLoader reports progress with a ProgressEvent-like object', async () => {

		const events = [];
		await new THREE.FileLoader().loadAsync( path.join( assets, 'quad.glb' ), ( event ) => {

			events.push( event );

		} );
		assert.ok( events.length > 0 );
		assert.equal( events[ 0 ].type, 'progress' );
		assert.equal( typeof events[ 0 ].loaded, 'number' );

	} );

	it( 'GLTFLoader loads a .glb with an embedded PNG', async () => {

		const { GLTFLoader } = await import( '@kmamal/three/addons/loaders/GLTFLoader.js' );
		const gltf = await new GLTFLoader().loadAsync( path.join( assets, 'quad.glb' ) );
		const map = gltf.scene.children[ 0 ].material.map;
		assert.equal( map.image.width, 128 );
		assert.equal( map.flipY, false );
		assert.deepEqual( pixelAt( map.image, 32, 32 ), QUADRANTS.topLeft );

	} );

	it( 'ObjectLoader tolerates a missing HTMLImageElement global', () => {

		assert.equal( typeof HTMLImageElement, 'undefined' );
		const object = new THREE.ObjectLoader().parse( { metadata: { version: 4.6, type: 'Object' }, object: { uuid: 'a', type: 'Object3D' } } );
		assert.equal( object.isObject3D, true );

	} );

	it( 'DOM-only elements stay unavailable with a clear message', async () => {

		const { platform } = await import( '../../../src/platform/Platform.js' );
		assert.throws( () => platform.createElement( 'video' ), /<video> elements are not available under SDL/ );
		assert.throws( () => platform.createCanvas( {} ), /needs a \{ window \}/ );

	} );

} );
