import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { SDLCanvas } from '../../../src/platform/sdl/SDLCanvas.js';

const createWindow = ( overrides = {} ) => Object.assign( new EventEmitter(), {
	width: 400,
	height: 300,
	pixelWidth: 800,
	pixelHeight: 600,
	native: {},
}, overrides );

describe( 'SDLCanvas', () => {

	it( 'starts with the window pixel size', () => {

		const canvas = new SDLCanvas( createWindow() );
		assert.equal( canvas.width, 800 );
		assert.equal( canvas.height, 600 );

	} );

	it( 'reports logical sizes as client sizes', () => {

		const canvas = new SDLCanvas( createWindow() );
		assert.equal( canvas.clientWidth, 400 );
		assert.equal( canvas.clientHeight, 300 );
		assert.equal( canvas.offsetWidth, 400 );
		assert.equal( canvas.offsetHeight, 300 );
		assert.equal( canvas.offsetLeft, 0 );
		assert.equal( canvas.offsetTop, 0 );

	} );

	it( 'follows the window when it changes', () => {

		const window = createWindow();
		const canvas = new SDLCanvas( window );
		window.width = 500;
		window.height = 100;
		assert.equal( canvas.clientWidth, 500 );
		assert.deepEqual( canvas.getBoundingClientRect(), { left: 0, top: 0, right: 500, bottom: 100, width: 500, height: 100, x: 0, y: 0 } );

	} );

	it( 'exposes a document and view with the members controls and loaders use', () => {

		const window = createWindow();
		const canvas = new SDLCanvas( window );
		const { ownerDocument } = canvas;
		assert.equal( canvas.getRootNode(), ownerDocument );
		assert.equal( ownerDocument.hidden, false );
		assert.equal( ownerDocument.pointerLockElement, null );
		assert.equal( ownerDocument.documentElement.clientWidth, 400 );
		assert.equal( ownerDocument.documentElement.clientLeft, 0 );
		const view = ownerDocument.defaultView;
		assert.equal( view.innerWidth, 400 );
		assert.equal( view.innerHeight, 300 );
		assert.equal( view.devicePixelRatio, 2 );
		assert.equal( view.pageXOffset, 0 );
		assert.equal( typeof view.requestAnimationFrame, 'function' );

	} );

	it( 'schedules animation frames through the view', async () => {

		const { defaultView } = new SDLCanvas( createWindow() ).ownerDocument;
		const timestamp = await new Promise( ( resolve ) => defaultView.requestAnimationFrame( resolve ) );
		assert.equal( typeof timestamp, 'number' );
		let called = false;
		const id = defaultView.requestAnimationFrame( () => {

			called = true;

		} );
		defaultView.cancelAnimationFrame( id );
		await new Promise( ( resolve ) => setTimeout( resolve, 30 ) );
		assert.equal( called, false );

	} );

	it( 'supports the element methods controls call', () => {

		const canvas = new SDLCanvas( createWindow() );
		assert.doesNotThrow( () => {

			canvas.setPointerCapture( 1 );
			canvas.releasePointerCapture( 1 );
			canvas.setAttribute( 'data-engine', 'x' );
			canvas.focus();

		} );
		assert.equal( canvas.style.cursor, '' );
		canvas.style.cursor = 'grab';
		assert.equal( canvas.style.cursor, 'grab' );

	} );

	it( 'is an event target that receives window events', () => {

		const window = createWindow();
		const canvas = new SDLCanvas( window );
		const seen = [];
		canvas.addEventListener( 'pointerdown', ( event ) => seen.push( event.clientX ) );
		window.emit( 'mouseButtonDown', { x: 12, y: 3, button: 1, touch: false, pen: false } );
		assert.deepEqual( seen, [ 12 ] );

	} );

	it( 'returns null for unknown context types', () => {

		assert.equal( new SDLCanvas( createWindow() ).getContext( '2d' ), null );

	} );

	it( 'present() does nothing before a context exists', () => {

		assert.doesNotThrow( () => new SDLCanvas( createWindow() ).present() );

	} );

	it( 'resizes the drawing buffer when width or height change', async () => {

		const canvas = new SDLCanvas( createWindow() );
		const calls = [];
		const resize = ( ...args ) => calls.push( [ 'gl', ...args ] );
		canvas._gl = { getExtension: () => ( { resize } ), swap: () => calls.push( [ 'swap' ] ) };
		canvas.width = 640;
		canvas.height = 480;
		canvas.width = 640;
		assert.deepEqual( calls, [[ 'gl', 640, 600 ], [ 'gl', 640, 480 ]] );
		canvas.present();
		await Promise.resolve();
		assert.deepEqual( calls.at( - 1 ), [ 'swap' ] );

	} );

	it( 'presents once at the end of the task however many times it is called', async () => {

		const canvas = new SDLCanvas( createWindow() );
		let swaps = 0;
		canvas._gl = { getExtension: () => ( { resize() {} } ), swap: () => {

			swaps ++;

		} };
		canvas.present();
		canvas.present();
		assert.equal( swaps, 0 );
		await Promise.resolve();
		assert.equal( swaps, 1 );
		canvas.present();
		await Promise.resolve();
		assert.equal( swaps, 2 );

	} );

	it( 'resizes the WebGPU surface when the size changes', async () => {

		const canvas = new SDLCanvas( createWindow() );
		const calls = [];
		canvas._gpuRenderer = { resize: () => calls.push( 'resize' ), swap: () => calls.push( 'swap' ) };
		canvas.height = 700;
		canvas.present();
		await Promise.resolve();
		assert.deepEqual( calls, [ 'resize', 'swap' ] );

	} );

} );

describe( 'Timer with the SDL document', () => {

	let THREE;

	before( async () => {

		THREE = await import( '@kmamal/three' );

	} );

	it( 'connects to the document and pauses while it is hidden', async () => {

		const { ownerDocument } = new SDLCanvas( createWindow() );
		const timer = new THREE.Timer();
		timer.connect( ownerDocument );
		timer.update();
		await new Promise( ( resolve ) => setTimeout( resolve, 40 ) );
		timer.update();
		assert.ok( timer.getDelta() > 0.02, 'time passes while visible' );
		ownerDocument.hidden = true;
		ownerDocument.dispatchEvent( new Event( 'visibilitychange' ) );
		await new Promise( ( resolve ) => setTimeout( resolve, 40 ) );
		timer.update();
		assert.equal( timer.getDelta(), 0, 'no time passes while hidden' );
		ownerDocument.hidden = false;
		ownerDocument.dispatchEvent( new Event( 'visibilitychange' ) );
		await new Promise( ( resolve ) => setTimeout( resolve, 40 ) );
		timer.update();
		assert.ok( timer.getDelta() < 0.3, 'the hidden period is not counted' );
		timer.disconnect();

	} );

	it( 'stops listening after disconnect', async () => {

		const { ownerDocument } = new SDLCanvas( createWindow() );
		const timer = new THREE.Timer();
		timer.connect( ownerDocument );
		timer.disconnect();
		ownerDocument.hidden = true;
		ownerDocument.dispatchEvent( new Event( 'visibilitychange' ) );
		timer.update();
		await new Promise( ( resolve ) => setTimeout( resolve, 30 ) );
		timer.update();
		assert.ok( timer.getDelta() > 0 );

	} );

} );
