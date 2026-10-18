import { createRequire } from 'node:module';
import { SDLCanvas } from './SDLCanvas.js';
import { createElement, getDocument, getPrimaryDocument } from './SDLDocument.js';
import { animationContext } from './SDLFrames.js';
import { SDLImage, SDLImageBitmap, createImageBitmapFromBlob } from './SDLImage.js';
import { sdlFetch, setFetchRoot } from './SDLFetch.js';
import { SDLWorker } from './SDLWorker.js';
import { SDLDOMParser } from './SDLDOMParser.js';
import * as canvas2D from './SDLCanvas2D.js';
import { SDLFileReader } from './SDLFileReader.js';

const require = createRequire( import.meta.url );

let gpuModule;
let gpuInstance = null;
let glModule;
let audioModule = null;

const loadGL = () => {

	if ( glModule === undefined ) {

		try {

			glModule = require( '@kmamal/gl' );

		} catch ( error ) {

			if ( error.code !== 'MODULE_NOT_FOUND' ) throw error;
			glModule = null;

		}

	}

	return glModule;

};

const loadGPU = () => {

	if ( gpuModule === undefined ) {

		try {

			gpuModule = require( '@kmamal/gpu' );

		} catch ( error ) {

			if ( error.code !== 'MODULE_NOT_FOUND' ) throw error;
			gpuModule = null;

		}

	}

	return gpuModule;

};

const loadAudio = () => {

	if ( audioModule === null ) {

		audioModule = require( '@kmamal/audio' );
		audioModule.configure( { fetch: sdlFetch } );

	}

	return audioModule;

};

class SDLProgressEvent extends Event {

	constructor( type, { lengthComputable = false, loaded = 0, total = 0, ...init } = {} ) {

		super( type, init );

		this.lengthComputable = lengthComputable;
		this.loaded = loaded;
		this.total = total;

	}

}

const primary = ( name ) => new Proxy( {}, {

	get( _, key ) {

		const document = getPrimaryDocument();

		if ( document === null ) throw new Error( `THREE: No SDL window has been created yet, so there is no ${name}.` );

		const target = name === 'window' ? document.defaultView : document;
		const value = Reflect.get( target, key, target );

		return typeof value === 'function' ? value.bind( target ) : value;

	},

	set( _, key, value ) {

		const document = getPrimaryDocument();

		if ( document === null ) throw new Error( `THREE: No SDL window has been created yet, so there is no ${name}.` );

		const target = name === 'window' ? document.defaultView : document;
		return Reflect.set( target, key, value, target );

	}

} );

const primaryWindow = primary( 'window' );
const primaryDocument = primary( 'document' );

const sdlPlatform = {

	fetch: sdlFetch,

	setFetchRoot,

	getDocument,

	get window() {

		return primaryWindow;

	},

	get document() {

		return primaryDocument;

	},

	get devicePixelRatio() {

		const document = getPrimaryDocument();
		if ( document !== null ) return document.defaultView.devicePixelRatio;

		const display = require( '@kmamal/sdl' ).video.displays[ 0 ];
		return display?.scale ?? 1;

	},

	isImage: canvas2D.isImage,

	isImageBitmap: ( image ) => image instanceof SDLImageBitmap,

	isCanvas: canvas2D.isCanvas,

	isOffscreenCanvas: canvas2D.isCanvas,

	get OffscreenCanvas() {

		return canvas2D.getCanvasClass();

	},

	get ImageData() {

		return canvas2D.getImageData();

	},

	Image: SDLImage,

	ImageBitmap: SDLImageBitmap,

	DOMParser: SDLDOMParser,

	FileReader: SDLFileReader,

	Worker: SDLWorker,

	ProgressEvent: globalThis.ProgressEvent ?? SDLProgressEvent,

	toDrawable: canvas2D.toDrawable,

	toImageData: canvas2D.toImageData,

	createImageBitmap: createImageBitmapFromBlob,

	animationContext,

	get audio() {

		return loadAudio();

	},

	get AudioContext() {

		return loadAudio().AudioContext;

	},

	get Audio() {

		return loadAudio().Audio;

	},

	createElement( name ) {

		return createElement( name );

	},

	createCanvas( parameters ) {

		if ( parameters === undefined ) return canvas2D.createCanvas2D();

		if ( parameters.window === undefined ) {

			throw new Error( 'THREE: Under SDL the renderer needs a { window } parameter.' );

		}

		return new SDLCanvas( parameters.window );

	},

	present( canvas ) {

		if ( canvas instanceof SDLCanvas ) canvas.present();

	},

	get WebGLRenderingContext() {

		return loadGL()?.WebGLRenderingContext;

	},

	get WebGL2RenderingContext() {

		return loadGL()?.WebGL2RenderingContext;

	},

	get gpu() {

		if ( gpuInstance === null ) {

			const gpu = loadGPU();
			if ( gpu === null ) return undefined;

			gpuInstance = gpu.create( [] );

		}

		return gpuInstance;

	},

	get GPURenderBundleEncoder() {

		return loadGPU()?.GPURenderBundleEncoder;

	}

};

export { sdlPlatform };
