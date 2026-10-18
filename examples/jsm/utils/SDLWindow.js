import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { platform } from '@kmamal/three/src/platform/Platform.js';
import { sdlFetch } from '@kmamal/three/src/platform/sdl/SDLFetch.js';
import { GUI } from '../libs/lil-gui.module.js';

const require = createRequire( import.meta.url );

const examplesRoot = path.resolve( fileURLToPath( new URL( '../../', import.meta.url ) ) );

/**
 * Opens the SDL window an example renders to and stands in for the browser globals
 * the example code reads. `window` and `document` are live bindings that point at the
 * first window created.
 *
 * @module SDLWindow
 */

let window = null;
let document = null;

let main = null;
let prepared = false;

function prepare() {

	if ( prepared ) return;

	prepared = true;

	process.chdir( examplesRoot );
	platform.setFetchRoot( path.dirname( examplesRoot ) );
	globalThis.fetch = sdlFetch;
	globalThis.alert ??= ( message ) => window.alert( message );
	globalThis.confirm ??= ( message ) => window.confirm( message );
	globalThis.prompt ??= ( message, defaultValue ) => window.prompt( message, defaultValue );
	platform.audio.install();

}

/**
 * Creates an SDL window for a renderer.
 *
 * @param {Object} [options] - The options.
 * @param {string} [options.title=''] - The window title.
 * @param {string} [options.api='webgpu'] - `'webgl'` for a `WebGLRenderer`, `'webgpu'` for a `WebGPURenderer`.
 * @param {boolean} [options.forceWebGL=false] - Whether the `WebGPURenderer` will be created with `forceWebGL`.
 * @param {number} [options.width=1024] - The initial width.
 * @param {number} [options.height=768] - The initial height.
 * @param {boolean} [options.resizable=true] - Whether the window can be resized.
 * @return {Object} The SDL window, to be passed as the `window` parameter of the renderer.
 */
function createWindow( { title = '', api = 'webgpu', forceWebGL = false, width = 1024, height = 768, resizable = true } = {} ) {

	prepare();

	const sdl = require( '@kmamal/sdl' );
	const options = { title, width, height, resizable };

	if ( api === 'webgpu' && forceWebGL === false ) options.webgpu = true;
	else options.opengl = true;

	const sdlWindow = sdl.video.createWindow( options );

	if ( main === null ) {

		main = { sdlWindow, title };

		const view = platform.getDocument( sdlWindow );

		document = view;
		window = view.defaultView;

	}

	sdlWindow.on( 'close', () => {

		GUI.destroyAll();
		process.exit( 0 );

	} );

	return sdlWindow;

}

/**
 * Returns the `window` and `document` stand-ins of an SDL window. Examples that open
 * more than one window use this to read the size of, and listen for events on, the
 * window each of their renderers draws to.
 *
 * @param {Object} sdlWindow - An SDL window created with `createWindow()`.
 * @return {{window: Object, document: Object}} The stand-ins.
 */
function viewOf( sdlWindow ) {

	const document = platform.getDocument( sdlWindow );

	return { window: document.defaultView, document };

}

/**
 * Creates a canvas that draws to an SDL window, to be wrapped in a `CanvasTarget`.
 *
 * @param {Object} sdlWindow - An SDL window created with `createWindow()`.
 * @return {Object} The canvas.
 */
function createCanvas( sdlWindow ) {

	return platform.createCanvas( { window: sdlWindow } );

}

/**
 * Appends a status text to the title of the first window.
 *
 * @param {string} [status=''] - The status text.
 */
function setStatus( status = '' ) {

	if ( main === null || main.sdlWindow.destroyed ) return;

	main.sdlWindow.setTitle( status === '' ? main.title : `${ main.title } - ${ status }` );

}

/**
 * Sets the title of the first window.
 *
 * @param {string} title - The title.
 */
function setTitle( title ) {

	if ( main === null ) return;

	main.title = title;
	setStatus();

}

/**
 * Writes data to a file, standing in for the browser download of a generated file.
 * Files go to the directory in the `EXAMPLE_OUTPUT` environment variable, or to
 * `three-examples` inside the system temporary directory.
 *
 * @param {Blob|ArrayBuffer|ArrayBufferView|string} data - The file contents.
 * @param {string} filename - The file name.
 * @return {Promise<string>} The path of the written file.
 */
async function saveFile( data, filename ) {

	let buffer;

	if ( typeof data === 'string' ) buffer = Buffer.from( data );
	else if ( data instanceof Blob ) buffer = Buffer.from( await data.arrayBuffer() );
	else if ( ArrayBuffer.isView( data ) ) buffer = Buffer.from( data.buffer, data.byteOffset, data.byteLength );
	else buffer = Buffer.from( data );

	const directory = process.env.EXAMPLE_OUTPUT ?? path.join( os.tmpdir(), 'three-examples' );
	const file = path.join( directory, path.basename( filename ) );

	await fs.mkdir( directory, { recursive: true } );
	await fs.writeFile( file, buffer );

	console.log( `saved ${file}` );

	return file;

}

export { createWindow, createCanvas, viewOf, setStatus, setTitle, saveFile, window, document };
