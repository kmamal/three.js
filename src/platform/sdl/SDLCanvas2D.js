import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { SDLImage } from './SDLImage.js';

const require = createRequire( import.meta.url );

const DEFAULT_WIDTH = 300;
const DEFAULT_HEIGHT = 150;

const FONT_ALIASES = [
	'Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI', 'Roboto', 'sans-serif', 'system-ui',
	'Times', 'Times New Roman', 'Georgia', 'serif',
	'Courier', 'Courier New', 'Consolas', 'Monaco', 'monospace'
];

function registerFontAliases( GlobalFonts ) {

	const installed = new Set( GlobalFonts.families.map( ( entry ) => entry.family ) );

	for ( const alias of FONT_ALIASES ) {

		if ( installed.has( alias ) ) continue;

		const match = spawnSync( 'fc-match', [ '-f', '%{family}', alias ], { encoding: 'utf8' } );
		if ( match.status !== 0 ) return;

		const family = match.stdout.split( ',' )[ 0 ].trim();
		if ( ! installed.has( family ) ) continue;

		GlobalFonts.setAlias( family, alias );
		GlobalFonts.setAlias( family, alias.toLowerCase() );

	}

}

let skia = null;
let Canvas2D = null;

const drawables = new WeakMap();
const patched = new WeakSet();

function load() {

	if ( skia !== null ) return skia;

	skia = require( '@napi-rs/canvas' );
	registerFontAliases( skia.GlobalFonts );

	Canvas2D = class extends skia.Canvas {

		constructor( width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT ) {

			super( width, height );
			this.style = {};
			Object.defineProperty( this, 'data', { value: undefined, writable: true, configurable: true } );
			Object.defineProperty( this, 'addEventListener', { value() {}, writable: true, configurable: true } );
			Object.defineProperty( this, 'removeEventListener', { value() {}, writable: true, configurable: true } );
			const getContext = this.getContext;
			Object.defineProperty( this, 'getContext', {
				value( ...args ) {

					const context = getContext.apply( this, args );
					if ( context !== null && ! patched.has( context ) ) {

						patched.add( context );
						const drawImage = context.drawImage;
						context.drawImage = function ( image, ...rest ) {

							if ( isUnloaded( image ) ) return;

							return drawImage.call( this, toDrawable( image ), ...rest );

						};

						const createPattern = context.createPattern;
						context.createPattern = function ( image, repetition ) {

							return createPattern.call( this, toDrawable( image ), repetition );

						};

						const getImageData = context.getImageData;
						context.getImageData = function ( x, y, w, h, settings ) {

							return getImageData.call( this, x, y, w, h, typeof settings === 'object' && settings !== null ? settings.colorSpace : settings );

						};

					}

					return context;

				},
				writable: true,
				configurable: true,
			} );

		}

	};

	return skia;

}

const isUnloaded = ( image ) => image instanceof SDLImage && image.data === null;

const hasPixels = ( image ) => image !== null && typeof image === 'object' && image.data !== undefined && typeof image.width === 'number' && typeof image.height === 'number';

function createCanvas2D( width, height ) {

	load();
	return new Canvas2D( width, height );

}

function isCanvas( image ) {

	return skia !== null && image instanceof skia.Canvas;

}

function isImage( image ) {

	return image instanceof SDLImage;

}

function getImageData() {

	return load().ImageData;

}

function getCanvasClass() {

	load();
	return Canvas2D;

}

function toDrawable( image ) {

	if ( ! hasPixels( image ) || isCanvas( image ) ) return image;

	let drawable = drawables.get( image );

	if ( drawable === undefined ) {

		const { ImageData } = load();
		drawable = createCanvas2D( image.width, image.height );
		drawable.getContext( '2d' ).putImageData( new ImageData( new Uint8ClampedArray( image.data.buffer, image.data.byteOffset, image.data.byteLength ), image.width, image.height ), 0, 0 );
		drawables.set( image, drawable );

	}

	return drawable;

}

function toImageData( image ) {

	if ( ! isCanvas( image ) ) return image;
	return image.getContext( '2d' ).getImageData( 0, 0, image.width, image.height );

}

export { createCanvas2D, isCanvas, isImage, getImageData, getCanvasClass, toDrawable, toImageData };
