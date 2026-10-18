import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { hasDisplay } from './harness.mjs';
import { createWindow, setStatus, setTitle, window, document } from '@kmamal/three/addons/utils/SDLWindow.js';
import Stats from '@kmamal/three/addons/libs/stats.module.js';
import { GUI } from '@kmamal/three/addons/libs/lil-gui.module.js';
import { platform } from '@kmamal/three/src/platform/Platform.js';

const examples = path.resolve( import.meta.dirname, '../../../examples' );
const nextEvent = ( target, type ) => new Promise( ( resolve ) => target.addEventListener( type, resolve, { once: true } ) );

describe( 'SDL example window', { skip: ! hasDisplay && 'needs a display' }, () => {

	let sdlWindow;
	let originalExit;

	before( async () => {

		originalExit = process.exit;
		sdlWindow = createWindow( { title: 'Example window', api: 'webgl', width: 320, height: 240 } );
		if ( process.env.I3SOCK ) {

			await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );
			spawnSync( 'i3-msg', [ '[title="Example window"] floating enable' ] );
			await new Promise( ( resolve ) => setTimeout( resolve, 300 ) );

		}

	} );

	after( () => {

		process.exit = originalExit;
		GUI.destroyAll();
		if ( ! sdlWindow.destroyed ) {

			sdlWindow.removeAllListeners( 'close' );
			sdlWindow.destroy();

		}

	} );

	it( 'opens an OpenGL window for webgl and a WebGPU window for webgpu', () => {

		assert.equal( sdlWindow.opengl, true );
		assert.equal( sdlWindow.webgpu, false );
		assert.equal( sdlWindow.title, 'Example window' );
		assert.equal( sdlWindow.resizable, true );

	} );

	it( 'exposes live window and document bindings for the first window', () => {

		assert.equal( document, platform.getDocument( sdlWindow ) );
		assert.equal( window, document.defaultView );
		assert.equal( window.innerWidth, sdlWindow.width );
		assert.equal( window.innerHeight, sdlWindow.height );
		assert.equal( window.devicePixelRatio, sdlWindow.pixelWidth / sdlWindow.width );

	} );

	it( 'shares the document with renderer canvases', () => {

		const canvas = platform.createCanvas( { window: sdlWindow } );
		assert.equal( canvas.ownerDocument, document );

	} );

	it( 'serves relative paths from the examples directory and rooted paths from the package', async () => {

		assert.equal( process.cwd(), examples );
		const relative = await platform.fetch( 'textures/crate.gif' );
		assert.equal( relative.status, 200 );
		const rooted = await platform.fetch( '/examples/textures/crate.gif' );
		assert.equal( rooted.status, 200 );

	} );

	it( 'fires resize on the window object when the window changes size', async () => {

		document.markPresented();
		const resized = nextEvent( window, 'resize' );
		sdlWindow.setSize( 400, 300 );
		await resized;
		const targetWidth = sdlWindow.width;
		assert.equal( window.innerWidth, targetWidth );

	} );

	it( 'shows a status after the title and restores it', () => {

		setStatus( '60 fps' );
		assert.equal( sdlWindow.title, 'Example window - 60 fps' );
		setStatus();
		assert.equal( sdlWindow.title, 'Example window' );
		setTitle( 'Other' );
		assert.equal( sdlWindow.title, 'Other' );
		setTitle( 'Example window' );

	} );

	it( 'reports Stats in the title once a second', () => {

		const stats = new Stats();
		let now = 0;
		stats._now = () => now;
		stats._prevTime = 0;
		stats._beginTime = 0;
		for ( let i = 0; i < 49; i ++ ) {

			now += 20;
			stats.update();

		}

		assert.equal( sdlWindow.title, 'Example window' );
		now += 20;
		stats.update();
		assert.match( sdlWindow.title, /^Example window - 50 fps, \d+ ms$/ );

	} );

	it( 'exposes the Stats API the examples call', () => {

		const stats = new Stats();
		assert.equal( typeof stats.begin, 'function' );
		assert.equal( typeof stats.end, 'function' );
		assert.equal( typeof stats.update, 'function' );
		assert.equal( typeof stats.dom.addEventListener, 'function' );
		stats.dom.style.top = '0px';
		assert.equal( stats.domElement, stats.dom );
		stats.begin();
		assert.equal( typeof stats.end(), 'number' );

	} );

	it( 'closes the GUI windows and exits when the first window closes', () => {

		const exits = [];
		process.exit = ( code ) => {

			exits.push( code );

		};

		const gui = new GUI( { title: 'Example GUI' } );
		assert.ok( gui._panel );
		sdlWindow.destroy();
		assert.deepEqual( exits, [ 0 ] );
		assert.equal( gui._panel, null );

	} );

} );
