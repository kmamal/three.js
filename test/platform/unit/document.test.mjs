import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { platform } from '@kmamal/three/src/platform/Platform.js';

const createWindow = () => Object.assign( new EventEmitter(), { width: 200, height: 100, pixelWidth: 400, pixelHeight: 200 } );

describe( 'shared SDL document', () => {

	it( 'returns one document per window', () => {

		const a = createWindow();
		const b = createWindow();
		assert.equal( platform.getDocument( a ), platform.getDocument( a ) );
		assert.notEqual( platform.getDocument( a ), platform.getDocument( b ) );
		assert.equal( platform.getDocument( a ).defaultView, platform.getDocument( a ).defaultView );

	} );

	it( 'is the document of canvases created for the window', () => {

		const window = createWindow();
		const canvas = platform.createCanvas( { window } );
		assert.equal( canvas.ownerDocument, platform.getDocument( window ) );
		assert.equal( canvas.getRootNode(), platform.getDocument( window ) );

	} );

	it( 'reflects the window size and pixel ratio', () => {

		const window = createWindow();
		const view = platform.getDocument( window ).defaultView;
		assert.equal( view.innerWidth, 200 );
		assert.equal( view.innerHeight, 100 );
		assert.equal( view.devicePixelRatio, 2 );
		window.width = 300;
		window.pixelWidth = 300;
		assert.equal( view.innerWidth, 300 );
		assert.equal( view.devicePixelRatio, 1 );

	} );

	it( 'dispatches resize on the view once a frame has been presented', () => {

		const window = createWindow();
		const document = platform.getDocument( window );
		let resizes = 0;
		document.defaultView.addEventListener( 'resize', () => {

			resizes ++;

		} );
		document.markPresented();
		window.emit( 'resize', { width: 10, height: 10, pixelWidth: 10, pixelHeight: 10 } );
		window.emit( 'resize', { width: 20, height: 20, pixelWidth: 20, pixelHeight: 20 } );
		assert.equal( resizes, 2 );

	} );

	it( 'holds resize events until the first frame is presented, then delivers one', async () => {

		const window = createWindow();
		const document = platform.getDocument( window );
		let resizes = 0;
		document.defaultView.addEventListener( 'resize', () => {

			resizes ++;

		} );
		window.emit( 'resize', {} );
		window.emit( 'resize', {} );
		assert.equal( resizes, 0 );
		document.markPresented();
		assert.equal( resizes, 0 );
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( resizes, 1 );
		document.markPresented();
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( resizes, 1 );

	} );

	it( 'presenting a canvas marks the document presented', async () => {

		const window = createWindow();
		const canvas = platform.createCanvas( { window } );
		let resizes = 0;
		canvas.ownerDocument.defaultView.addEventListener( 'resize', () => {

			resizes ++;

		} );
		window.emit( 'resize', {} );
		platform.present( canvas );
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.equal( resizes, 1 );

	} );

	it( 'does not dispatch resize to the view of another window', () => {

		const a = createWindow();
		const b = createWindow();
		let resizes = 0;
		platform.getDocument( b ).defaultView.addEventListener( 'resize', () => {

			resizes ++;

		} );
		platform.getDocument( b ).markPresented();
		platform.getDocument( a ).markPresented();
		a.emit( 'resize', {} );
		assert.equal( resizes, 0 );

	} );

	it( 'delivers input events to listeners on the shared view and document', () => {

		const window = createWindow();
		const canvas = platform.createCanvas( { window } );
		const view = platform.getDocument( window ).defaultView;
		const seen = [];
		view.addEventListener( 'keydown', ( event ) => seen.push( [ 'view', event.key ] ) );
		canvas.ownerDocument.addEventListener( 'keydown', ( event ) => seen.push( [ 'document', event.key ] ) );
		window.emit( 'keyDown', { key: 'a' } );
		assert.deepEqual( seen, [[ 'document', 'a' ], [ 'view', 'a' ]] );

	} );

} );
