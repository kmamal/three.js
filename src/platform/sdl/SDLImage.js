import { createRequire } from 'node:module';
import { sdlFetch } from './SDLFetch.js';

const require = createRequire( import.meta.url );

let sharp = null;

const loadSharp = () => {

	if ( sharp === null ) sharp = require( 'sharp' );
	return sharp;

};

async function decodeImageBytes( bytes, { flipY = false, premultiply = false } = {} ) {

	let pipeline = loadSharp()( bytes, { failOn: 'none' } ).rotate();
	if ( flipY ) pipeline = pipeline.flip();

	const { data, info } = await pipeline
		.toColourspace( 'srgb' )
		.ensureAlpha()
		.raw()
		.toBuffer( { resolveWithObject: true } );

	const pixels = new Uint8Array( data.buffer, data.byteOffset, data.byteLength );

	if ( premultiply ) {

		for ( let i = 0; i < pixels.length; i += 4 ) {

			const alpha = pixels[ i + 3 ];
			if ( alpha === 255 ) continue;
			pixels[ i ] = Math.round( pixels[ i ] * alpha / 255 );
			pixels[ i + 1 ] = Math.round( pixels[ i + 1 ] * alpha / 255 );
			pixels[ i + 2 ] = Math.round( pixels[ i + 2 ] * alpha / 255 );

		}

	}

	return { width: info.width, height: info.height, data: pixels };

}

class SDLImageBitmap {

	get [ Symbol.toStringTag ]() {

		return 'ImageBitmap';

	}

	constructor( { width, height, data } ) {

		this.width = width;
		this.height = height;
		this.data = data;

	}

	close() {

		this.data = null;
		this.width = 0;
		this.height = 0;

	}

}

async function createImageBitmapFromBlob( blob, options = {} ) {

	const decoded = await decodeImageBytes( Buffer.from( await blob.arrayBuffer() ), {
		flipY: options.imageOrientation === 'flipY',
		premultiply: options.premultiplyAlpha === 'premultiply',
	} );

	return new SDLImageBitmap( decoded );

}

class SDLImage extends EventTarget {

	constructor() {

		super();

		this.width = 0;
		this.height = 0;
		this.data = null;
		this.complete = false;
		this.crossOrigin = null;
		this._src = '';

	}

	get naturalWidth() {

		return this.width;

	}

	get naturalHeight() {

		return this.height;

	}

	dispatchEvent( event ) {

		const handler = this[ 'on' + event.type ];
		if ( typeof handler === 'function' ) handler.call( this, event );

		return super.dispatchEvent( event );

	}

	get src() {

		return this._src;

	}

	set src( value ) {

		this._src = value;
		this.complete = false;
		this._decode( value );

	}

	async _decode( source ) {

		try {

			const response = await sdlFetch( source );

			if ( response.status !== 200 ) throw new Error( `Failed to load "${source}" (${response.status} ${response.statusText})` );

			const bytes = Buffer.from( await response.arrayBuffer() );

			const decoded = await decodeImageBytes( bytes );

			if ( this._src !== source ) return;

			this.width = decoded.width;
			this.height = decoded.height;
			this.data = decoded.data;
			this.complete = true;

			this.dispatchEvent( new Event( 'load' ) );

		} catch ( error ) {

			if ( this._src !== source ) return;

			const event = new Event( 'error' );
			event.error = error;
			event.message = error.message;
			this.dispatchEvent( event );

		}

	}

}

export { SDLImage, SDLImageBitmap, createImageBitmapFromBlob };
