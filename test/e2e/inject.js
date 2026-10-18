import fs from 'node:fs';
import { createRequire, register } from 'node:module';
import { PNG } from 'pngjs';
import { isBusy } from './track.js';
import { animationContext } from '../../src/platform/sdl/SDLFrames.js';
import { SDLDocument } from '../../src/platform/sdl/SDLDocument.js';
import { SDLCanvas } from '../../src/platform/sdl/SDLCanvas.js';

register( './hooks.js', import.meta.url );

const require = createRequire( import.meta.url );
const sdl = require( '@kmamal/sdl' );

const width = Number( process.env.E2E_WIDTH ?? 800 );
const height = Number( process.env.E2E_HEIGHT ?? 500 );
const settle = Number( process.env.E2E_SETTLE ?? 2000 );
const present = Number( process.env.E2E_PRESENT ?? 500 );
const cap = Number( process.env.E2E_CAP ?? 30000 );
const captureFile = process.env.E2E_CAPTURE;

const report = ( error ) => console.log( `E2E_ERROR ${ String( error?.stack ?? error ).split( '\n' ).join( ' | ' ) }` );

process.on( 'uncaughtException', report );
process.on( 'unhandledRejection', report );

const consoleError = console.error;
console.error = ( ...args ) => {

	consoleError( ...args );
	report( args.map( String ).join( ' ' ) );

};

Math._random = Math.random;
Math.random = ( () => {

	let seed = Math.PI / 4;

	return () => {

		const x = Math.sin( seed ++ ) * 10000;
		return x - Math.floor( x );

	};

} )();

const now = () => 0;
Date.now = now;
Date.prototype.getTime = now;
performance.now = now;

let primaryWindow = null;
const createWindow = sdl.video.createWindow.bind( sdl.video );

sdl.video.createWindow = ( options = {} ) => {

	if ( options.accelerated === false ) return createWindow( { ...options, visible: false } );

	if ( primaryWindow !== null ) return createWindow( options );

	primaryWindow = createWindow( { ...options, width, height, resizable: false } );
	return primaryWindow;

};

let frame = null;
let pendingFrame = Promise.resolve();
const devices = new WeakMap();

const readGL = ( gl ) => {

	const w = gl.drawingBufferWidth;
	const h = gl.drawingBufferHeight;
	const pixels = new Uint8Array( w * h * 4 );

	const readFramebuffer = gl.getParameter( gl.READ_FRAMEBUFFER_BINDING );
	const packBuffer = gl.getParameter( gl.PIXEL_PACK_BUFFER_BINDING );

	gl.bindFramebuffer( gl.READ_FRAMEBUFFER, null );
	gl.bindBuffer( gl.PIXEL_PACK_BUFFER, null );
	gl.readPixels( 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels );
	gl.bindBuffer( gl.PIXEL_PACK_BUFFER, packBuffer );
	gl.bindFramebuffer( gl.READ_FRAMEBUFFER, readFramebuffer );

	const data = Buffer.alloc( w * h * 4 );
	const row = w * 4;

	for ( let y = 0; y < h; y ++ ) data.set( pixels.subarray( ( h - 1 - y ) * row, ( h - y ) * row ), y * row );

	frame = { width: w, height: h, data };

};

const readGPU = ( canvas ) => {

	const device = devices.get( canvas );
	const texture = canvas._gpuRenderer.getCurrentTexture();
	const w = texture.width;
	const h = texture.height;
	const bgra = texture.format.startsWith( 'bgra' );
	const row = w * 4;
	const bytesPerRow = Math.ceil( row / 256 ) * 256;
	const { GPUBufferUsage, GPUMapMode } = require( '@kmamal/gpu' );

	const buffer = device.createBuffer( { size: bytesPerRow * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ } );
	const encoder = device.createCommandEncoder();
	encoder.copyTextureToBuffer( { texture }, { buffer, bytesPerRow }, { width: w, height: h } );
	device.queue.submit( [ encoder.finish() ] );

	pendingFrame = buffer.mapAsync( GPUMapMode.READ ).then( () => {

		const source = new Uint8Array( buffer.getMappedRange() );
		const data = Buffer.alloc( w * h * 4 );

		for ( let y = 0; y < h; y ++ ) data.set( source.subarray( y * bytesPerRow, y * bytesPerRow + row ), y * row );

		if ( bgra ) {

			for ( let i = 0; i < data.length; i += 4 ) {

				const blue = data[ i ];
				data[ i ] = data[ i + 2 ];
				data[ i + 2 ] = blue;

			}

		}

		buffer.unmap();
		buffer.destroy();
		frame = { width: w, height: h, data };

	} );

};

const getGPURenderer = SDLCanvas.prototype.getGPURenderer;
SDLCanvas.prototype.getGPURenderer = function ( device, ...rest ) {

	devices.set( this, device );
	return getGPURenderer.call( this, device, ...rest );

};

let presented = false;
const presentCanvas = SDLCanvas.prototype.present;
SDLCanvas.prototype.present = function ( ...args ) {

	if ( this.window === primaryWindow && this._presentPending === false ) {

		presented = true;

		queueMicrotask( () => {

			if ( this._gl !== null ) readGL( this._gl );
			else if ( this._gpuRenderer !== null ) readGPU( this );

		} );

	}

	return presentCanvas.apply( this, args );

};

const clickStartButton = ( element ) => {

	if ( element.id !== 'startButton' ) return element;

	const addEventListener = element.addEventListener.bind( element );

	element.addEventListener = ( type, listener, ...rest ) => {

		addEventListener( type, listener, ...rest );
		if ( type === 'click' ) setImmediate( () => listener( new Event( 'click' ) ) );

	};

	return element;

};

for ( const method of [ 'getElementById', 'querySelector' ] ) {

	const original = SDLDocument.prototype[ method ];

	SDLDocument.prototype[ method ] = function ( ...args ) {

		return clickStartButton( original.apply( this, args ) );

	};

}

let announced = false;

const announce = async ( capped ) => {

	if ( announced ) return;
	announced = true;

	try {

		await pendingFrame;

		if ( frame === null ) {

			console.log( 'E2E_NOTHING_PRESENTED' );

		} else {

			for ( let i = 3; i < frame.data.length; i += 4 ) frame.data[ i ] = 255;
			fs.writeFileSync( captureFile, PNG.sync.write( frame ) );

		}

	} catch ( error ) {

		report( error );

	}

	console.log( capped ? 'E2E_CAPPED' : 'E2E_RENDERED' );

};

setTimeout( () => announce( true ), cap );

const queue = new Map();
let nextId = 1;
let scheduled = false;
let finished = false;

const runFrame = () => {

	if ( isBusy() ) {

		setTimeout( runFrame, 250 );
		return;

	}

	const callbacks = [ ...queue.values() ];
	queue.clear();

	for ( const callback of callbacks ) {

		try {

			callback( now() );

		} catch ( error ) {

			report( error );

		}

	}

	if ( presented || queue.size === 0 ) {

		finished = true;
		setTimeout( () => announce( false ), present );

	} else {

		setTimeout( runFrame, 100 );

	}

};

animationContext.requestAnimationFrame = ( callback ) => {

	if ( finished ) return 0;

	const id = nextId ++;
	queue.set( id, callback );

	if ( scheduled === false ) {

		scheduled = true;
		setImmediate( () => setTimeout( runFrame, settle + 100 ) );

	}

	return id;

};

animationContext.cancelAnimationFrame = ( id ) => {

	queue.delete( id );

};
