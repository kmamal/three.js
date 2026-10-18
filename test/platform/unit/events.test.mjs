import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { bindWindowEvents } from '../../../src/platform/sdl/SDLEvents.js';

const require = createRequire( import.meta.url );
const { SCANCODE } = require( '@kmamal/sdl' ).keyboard;

const createFixture = () => {

	const received = [];
	const sink = ( name, extra = {} ) => {

		const target = new EventTarget();
		target.addEventListener = target.addEventListener.bind( target );
		const dispatchEvent = target.dispatchEvent.bind( target );
		target.dispatchEvent = ( event ) => {

			received.push( { target: name, event } );
			return dispatchEvent( event );

		};

		return Object.assign( target, extra );

	};

	const view = sink( 'view' );
	const document = sink( 'document', {
		defaultView: view,
		pointerLockElement: null,
		exitPointerLock() {

			this.pointerLockElement = null;

		},
	} );
	const canvas = sink( 'canvas', { ownerDocument: document } );
	const window = new EventEmitter();
	const unbind = bindWindowEvents( canvas, window );
	const of = ( type ) => received.filter( ( entry ) => entry.event.type === type );
	return { window, canvas, document, view, received, of, unbind };

};

const mouse = { x: 10, y: 20, dx: 1, dy: 2, touch: false, pen: false };
const key = ( name, scancode ) => ( { key: name, scancode, repeat: false, shift: true, ctrl: false, alt: false, super: false } );

describe( 'SDL event bridge', () => {

	it( 'dispatches one event along canvas, document and view', () => {

		const { window, of } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		const entries = of( 'pointerdown' );
		assert.deepEqual( entries.map( ( entry ) => entry.target ), [ 'canvas', 'document', 'view' ] );
		assert.ok( entries.every( ( entry ) => entry.event === entries[ 0 ].event ) );

	} );

	it( 'keeps the canvas as the target', () => {

		const { window, canvas, of } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		assert.ok( of( 'pointerdown' ).every( ( entry ) => entry.event.target === canvas ) );

	} );

	it( 'stops at the node that calls stopPropagation', () => {

		const { window, document, of } = createFixture();
		document.addEventListener( 'pointerdown', ( event ) => event.stopPropagation() );
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		assert.deepEqual( of( 'pointerdown' ).map( ( entry ) => entry.target ), [ 'canvas', 'document' ] );

	} );

	it( 'maps coordinates, button and pointer type', () => {

		const { window, of } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 3 } );
		const { event } = of( 'pointerdown' )[ 0 ];
		assert.equal( event.clientX, 10 );
		assert.equal( event.clientY, 20 );
		assert.equal( event.pageX, 10 );
		assert.equal( event.button, 2 );
		assert.equal( event.buttons, 2 );
		assert.equal( event.pointerType, 'mouse' );
		assert.equal( event.isPrimary, true );

	} );

	it( 'reports touch and pen pointer types', () => {

		const { window, of } = createFixture();
		window.emit( 'mouseMove', { ...mouse, touch: true } );
		window.emit( 'mouseMove', { ...mouse, pen: true } );
		const moves = of( 'pointermove' ).filter( ( entry ) => entry.target === 'canvas' );
		assert.equal( moves[ 0 ].event.pointerType, 'touch' );
		assert.equal( moves[ 1 ].event.pointerType, 'pen' );

	} );

	it( 'tracks the pressed button mask across down, move and up', () => {

		const { window, received } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		window.emit( 'mouseButtonDown', { ...mouse, button: 2 } );
		window.emit( 'mouseMove', mouse );
		window.emit( 'mouseButtonUp', { ...mouse, button: 1 } );
		window.emit( 'mouseMove', mouse );
		const pointerEvents = received.filter( ( entry ) => entry.target === 'canvas' && entry.event.type.startsWith( 'pointer' ) ).map( ( entry ) => entry.event );
		assert.deepEqual( pointerEvents.map( ( event ) => event.buttons ), [ 1, 5, 5, 4, 4 ] );
		assert.equal( pointerEvents[ 2 ].type, 'pointermove' );
		assert.equal( pointerEvents[ 2 ].button, - 1 );

	} );

	it( 'follows pointer events with compatibility mouse events and a click', () => {

		const { window, received } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		window.emit( 'mouseMove', mouse );
		window.emit( 'mouseButtonUp', { ...mouse, button: 1 } );
		const types = received.filter( ( entry ) => entry.target === 'canvas' ).map( ( entry ) => entry.event.type );
		assert.deepEqual( types, [ 'pointerdown', 'mousedown', 'pointermove', 'mousemove', 'pointerup', 'mouseup', 'click' ] );

	} );

	it( 'suppresses compatibility mouse events when pointerdown is canceled', () => {

		const { window, canvas, received } = createFixture();
		canvas.addEventListener( 'pointerdown', ( event ) => event.preventDefault() );
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		window.emit( 'mouseMove', mouse );
		window.emit( 'mouseButtonUp', { ...mouse, button: 1 } );
		window.emit( 'mouseMove', mouse );
		const types = received.filter( ( entry ) => entry.target === 'canvas' ).map( ( entry ) => entry.event.type );
		assert.deepEqual( types, [ 'pointerdown', 'pointermove', 'pointerup', 'click', 'pointermove', 'mousemove' ] );

	} );

	it( 'reports a second quick click as a double click', () => {

		const { window, of } = createFixture();
		for ( let i = 0; i < 2; i ++ ) {

			window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
			window.emit( 'mouseButtonUp', { ...mouse, button: 1 } );

		}

		assert.equal( of( 'dblclick' ).filter( ( entry ) => entry.target === 'canvas' ).length, 1 );

	} );

	it( 'opens the context menu on a right button press', () => {

		const { window, of } = createFixture();
		window.emit( 'mouseButtonDown', { ...mouse, button: 3 } );
		assert.equal( of( 'contextmenu' ).filter( ( entry ) => entry.target === 'canvas' ).length, 1 );

	} );

	it( 'translates wheel deltas and honors flipped scrolling', () => {

		const { window, of } = createFixture();
		window.emit( 'mouseWheel', { ...mouse, dx: 0, dy: 1, flipped: false } );
		window.emit( 'mouseWheel', { ...mouse, dx: 0, dy: 1, flipped: true } );
		const wheels = of( 'wheel' ).filter( ( entry ) => entry.target === 'canvas' ).map( ( entry ) => entry.event );
		assert.equal( wheels[ 0 ].deltaY, - 100 );
		assert.equal( wheels[ 1 ].deltaY, 100 );
		assert.equal( wheels[ 0 ].deltaMode, 0 );

	} );

	it( 'maps keys to DOM keys and scancodes to physical DOM codes', () => {

		const { window, of } = createFixture();
		const keys = [
			[ 'left', SCANCODE.LEFT ],
			[ 'q', SCANCODE.A ],
			[ ' ', SCANCODE.SPACE ],
			[ 'return', SCANCODE.RETURN ],
			[ '7', SCANCODE[ 7 ] ],
			[ 'f5', SCANCODE.F5 ],
			[ 'shift', SCANCODE.RSHIFT ],
			[ '1', SCANCODE.KP_1 ],
			[ null, 0 ],
		];
		for ( const [ name, scancode ] of keys ) window.emit( 'keyDown', key( name, scancode ) );
		const events = of( 'keydown' ).filter( ( entry ) => entry.target === 'canvas' ).map( ( entry ) => entry.event );
		assert.deepEqual( events.map( ( event ) => event.key ), [ 'ArrowLeft', 'q', ' ', 'Enter', '7', 'F5', 'Shift', '1', 'Unidentified' ] );
		assert.deepEqual( events.map( ( event ) => event.code ), [ 'ArrowLeft', 'KeyA', 'Space', 'Enter', 'Digit7', 'F5', 'ShiftRight', 'Numpad1', '' ] );
		assert.equal( events[ 0 ].shiftKey, true );

	} );

	it( 'carries modifier state into later pointer events', () => {

		const { window, of } = createFixture();
		window.emit( 'keyDown', { ...key( 'ctrl', SCANCODE.LCTRL ), shift: false, ctrl: true } );
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		const pointer = of( 'pointerdown' )[ 0 ].event;
		assert.equal( pointer.ctrlKey, true );
		assert.equal( pointer.shiftKey, false );

	} );

	it( 'cancels the pointer on blur only while a button is held', () => {

		const { window, received } = createFixture();
		window.emit( 'blur' );
		assert.equal( received.length, 0 );
		window.emit( 'mouseButtonDown', { ...mouse, button: 1 } );
		received.length = 0;
		window.emit( 'blur' );
		assert.equal( received[ 0 ].event.type, 'pointercancel' );

	} );

	it( 'targets the pointer lock element and releases it on Escape', () => {

		const { window, document, of } = createFixture();
		const body = new EventTarget();
		document.pointerLockElement = body;
		window.emit( 'mouseMove', mouse );
		assert.equal( of( 'pointermove' )[ 0 ].event.target, body );
		window.emit( 'keyDown', key( 'escape', SCANCODE.ESCAPE ) );
		assert.equal( document.pointerLockElement, null );

	} );

	it( 'stops delivering events after unbinding', () => {

		const { window, received, unbind } = createFixture();
		unbind();
		window.emit( 'mouseMove', mouse );
		assert.equal( received.length, 0 );

	} );

} );
