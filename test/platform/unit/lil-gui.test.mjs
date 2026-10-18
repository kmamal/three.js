import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { GUI, Controller, NumberController, BooleanController, StringController, OptionController, ColorController, FunctionController } from '../../../examples/jsm/libs/lil-gui.module.js';

const require = createRequire( import.meta.url );
const { createCanvas } = require( '@napi-rs/canvas' );

class FakeWindow extends EventEmitter {

	constructor( options, scale ) {

		super();
		this.options = options;
		this.title = options.title;
		this.width = options.width;
		this.height = options.height;
		this.scale = scale;
		this.visible = options.visible;
		this.destroyed = false;
		this.renders = [];
		this.sizes = [];

	}
	get pixelWidth() {

		return Math.round( this.width * this.scale );

	}
	get pixelHeight() {

		return Math.round( this.height * this.scale );

	}
	render( ...args ) {

		this.renders.push( args );

	}
	setSize( width, height ) {

		this.sizes.push( [ width, height ] );
		this.width = width;
		this.height = height;
		this.emit( 'resize', { width, height, pixelWidth: this.pixelWidth, pixelHeight: this.pixelHeight } );

	}
	setPosition() {}
	setTitle( title ) {

		this.title = title;

	}
	show() {

		this.visible = true;

	}
	hide() {

		this.visible = false;

	}
	destroy() {

		this.destroyed = true; this.emit( 'close' );

	}

}

const createBackend = ( scale = 1, displayHeight = 1000 ) => {

	const backend = {
		windows: [],
		clipboardText: '',
		createCanvas: ( w, h ) => createCanvas( w, h ),
		createWindow( options ) {

			const window = new FakeWindow( options, scale );
			backend.windows.push( window );
			return window;

		},
		getDisplayBounds: () => ( { x: 0, y: 0, width: 1600, height: displayHeight } ),
		floatWindow: () => Promise.resolve(),
	};
	backend.clipboard = {
		get text() {

			return backend.clipboardText;

		},
		setText( text ) {

			backend.clipboardText = text;

		},
	};
	return backend;

};

const flush = ( gui ) => {

	const panel = gui._panel;
	for ( let i = 0; i < 2; i ++ ) {

		clearTimeout( panel._timer );
		panel._timer = null;
		panel._draw();

	}

};

const click = ( gui, window, x, y ) => {

	window.emit( 'mouseMove', { x, y, dx: 0, dy: 0 } );
	window.emit( 'mouseButtonDown', { x, y, button: 1 } );
	window.emit( 'mouseButtonUp', { x, y, button: 1 } );
	flush( gui );

};

const center = ( rect ) => [ rect.x + rect.w / 2, rect.y + rect.h / 2 ];

const key = ( window, name, extra = {} ) => {

	window.emit( 'keyDown', { key: name, shift: false, ctrl: false, alt: false, ...extra } );
	window.emit( 'keyUp', { key: name, shift: false, ctrl: false, alt: false, ...extra } );

};

const type = ( window, text ) => {

	for ( const character of text ) window.emit( 'textInput', { text: character } );

};

describe( 'lil-gui model', () => {

	let gui;
	beforeEach( () => {

		gui = new GUI( { autoPlace: false } );

	} );

	it( 'creates the controller type from the property type', () => {

		const o = { n: 1, b: true, s: 'x', f: () => {}, o: 'a' };
		assert.ok( gui.add( o, 'n' ) instanceof NumberController );
		assert.ok( gui.add( o, 'b' ) instanceof BooleanController );
		assert.ok( gui.add( o, 's' ) instanceof StringController );
		assert.ok( gui.add( o, 'f' ) instanceof FunctionController );
		assert.ok( gui.add( o, 'o', [ 'a', 'b' ] ) instanceof OptionController );
		assert.ok( gui.addColor( { c: '#fff' }, 'c' ) instanceof ColorController );
		assert.ok( gui.controllers.every( ( c ) => c instanceof Controller ) );
		assert.equal( gui.children.length, 6 );

	} );

	it( 'snaps and clamps number values like lil-gui', () => {

		const o = { a: 5, b: 0.5 };
		const a = gui.add( o, 'a', 0, 10, 2 );
		const b = gui.add( o, 'b', 0, 1 );
		a._snapClampSetValue( 7.2 );
		assert.equal( o.a, 8 );
		a._snapClampSetValue( 100 );
		assert.equal( o.a, 10 );
		assert.equal( b._step, 0.001 );
		b._snapClampSetValue( 0.12345 );
		assert.equal( o.b, 0.123 );

	} );

	it( 'has a slider only with both min and max', () => {

		const o = { a: 1, b: 1 };
		const a = gui.add( o, 'a', 0 );
		assert.equal( a._hasSlider, false );
		a.max( 5 );
		assert.equal( a._hasSlider, true );
		assert.equal( gui.add( o, 'b' )._hasSlider, false );

	} );

	it( 'calls onChange with the controller as this and finish only after a change', () => {

		const o = { a: 1 };
		const calls = [];
		const c = gui.add( o, 'a' ).onChange( function ( value ) {

			calls.push( [ 'change', this === c, value ] );

		} ).onFinishChange( ( value ) => calls.push( [ 'finish', value ] ) );
		c._callOnFinishChange();
		assert.deepEqual( calls, [] );
		c.setValue( 2 );
		c.setValue( 2 );
		c._callOnFinishChange();
		assert.deepEqual( calls, [[ 'change', true, 2 ], [ 'finish', 2 ]] );

	} );

	it( 'bubbles change events up through folders with an event object', () => {

		const o = { a: 1 };
		const events = [];
		const folder = gui.addFolder( 'F' );
		gui.onChange( ( event ) => events.push( event ) );
		const c = folder.add( o, 'a' );
		c.setValue( 3 );
		assert.equal( events.length, 1 );
		assert.equal( events[ 0 ].object, o );
		assert.equal( events[ 0 ].property, 'a' );
		assert.equal( events[ 0 ].value, 3 );
		assert.equal( events[ 0 ].controller, c );

	} );

	it( 'saves, loads and resets', () => {

		const o = { a: 1, s: 'x', f: () => {} };
		const folder = gui.addFolder( 'F' );
		gui.add( o, 'a' );
		gui.add( o, 'f' );
		folder.add( o, 's' );
		const saved = gui.save();
		assert.deepEqual( saved, { controllers: { a: 1 }, folders: { F: { controllers: { s: 'x' }, folders: {} } } } );
		o.a = 5;
		o.s = 'y';
		gui.load( saved );
		assert.equal( o.a, 1 );
		assert.equal( o.s, 'x' );
		o.a = 9;
		gui.reset();
		assert.equal( o.a, 1 );

	} );

	it( 'rejects duplicate names on save', () => {

		const o = { a: 1 };
		gui.add( o, 'a' );
		gui.add( o, 'a' );
		assert.throws( () => gui.save(), /duplicate/ );

	} );

	it( 'maps options arrays and objects', () => {

		const o = { m: 2 };
		const c = gui.add( o, 'm', { low: 1, mid: 2, high: 3 } );
		assert.deepEqual( c._names, [ 'low', 'mid', 'high' ] );
		assert.equal( c._displayText(), 'mid' );
		c._select( 2 );
		assert.equal( o.m, 3 );
		const n = gui.add( { v: 'a' }, 'v' );
		const replaced = n.options( [ 'a', 'b' ] );
		assert.ok( replaced instanceof OptionController );
		assert.equal( gui.controllers.includes( n ), false );

	} );

	it( 'supports every color format', () => {

		const o = { s: '#ff0000', i: 0x00ff00, a: [ 0, 0, 1 ], r: { r: 1, g: 1, b: 0 }, big: { r: 255, g: 0, b: 0 } };
		const s = gui.addColor( o, 's' );
		const i = gui.addColor( o, 'i' );
		const a = gui.addColor( o, 'a' );
		const r = gui.addColor( o, 'r' );
		const big = gui.addColor( o, 'big', 255 );
		assert.deepEqual( s._getRGB(), [ 255, 0, 0 ] );
		assert.deepEqual( i._getRGB(), [ 0, 255, 0 ] );
		assert.deepEqual( a._getRGB(), [ 0, 0, 255 ] );
		assert.deepEqual( r._getRGB(), [ 255, 255, 0 ] );
		assert.deepEqual( big._getRGB(), [ 255, 0, 0 ] );
		s._setRGB( [ 0, 0, 255 ] );
		i._setRGB( [ 255, 0, 255 ] );
		a._setRGB( [ 255, 255, 255 ] );
		r._setRGB( [ 0, 255, 0 ] );
		big._setRGB( [ 0, 0, 255 ] );
		assert.equal( o.s, '#0000ff' );
		assert.equal( o.i, 0xff00ff );
		assert.deepEqual( o.a, [ 1, 1, 1 ] );
		assert.deepEqual( o.r, { r: 0, g: 1, b: 0 } );
		assert.deepEqual( o.big, { r: 0, g: 0, b: 255 } );
		s.setValue( '#abc' );
		assert.equal( o.s, '#aabbcc' );

	} );

	it( 'keeps the color object identity so three.js colors can be bound', () => {

		class FakeColor {

			constructor() {

				this.r = 1; this.g = 0; this.b = 0;

			}

		}
		const color = new FakeColor();
		const c = gui.addColor( { color }, 'color' );
		c._setRGB( [ 0, 255, 0 ] );
		assert.equal( c.getValue(), color );
		assert.equal( color.g, 1 );

	} );

	it( 'tracks open state and fires onOpenClose', () => {

		const folder = gui.addFolder( 'F' );
		const seen = [];
		gui.onOpenClose( ( changed ) => seen.push( changed ) );
		folder.close();
		folder.close();
		folder.open();
		assert.deepEqual( seen, [ folder, folder ] );
		assert.equal( folder._closed, false );

	} );

	it( 'closes folders on creation with closeFolders', () => {

		const g = new GUI( { autoPlace: false, closeFolders: true } );
		assert.equal( g.addFolder( 'x' )._closed, true );

	} );

	it( 'computes heights like the lil-gui layout', () => {

		const o = { a: 1, b: true };
		assert.equal( gui._height(), 25 );
		gui.add( o, 'a' );
		gui.add( o, 'b' );
		assert.equal( gui._height(), 25 + 4 + 20 + 4 + 20 + 4 );
		const folder = gui.addFolder( 'F' );
		folder.add( o, 'a' );
		assert.equal( gui._height(), 25 + 4 + 20 + 4 + 20 + 4 + 25 + 4 + 20 + 4 );
		folder.close();
		assert.equal( gui._height(), 25 + 4 + 20 + 4 + 20 + 4 + 25 );

	} );

	it( 'hides controllers and folders', () => {

		const o = { a: 1, b: 2 };
		const a = gui.add( o, 'a' );
		gui.add( o, 'b' );
		const before = gui._height();
		a.hide();
		assert.equal( gui._height(), before - 24 );
		a.show();
		assert.equal( gui._height(), before );

	} );

	it( 'destroys controllers and folders', () => {

		const o = { a: 1 };
		const c = gui.add( o, 'a' );
		const folder = gui.addFolder( 'F' );
		const inner = folder.add( o, 'a' );
		c.destroy();
		inner.destroy();
		folder.destroy();
		assert.equal( gui.children.length, 0 );
		assert.equal( gui.controllers.length, 0 );
		assert.equal( gui.folders.length, 0 );

	} );

	it( 'lists controllers and folders recursively', () => {

		const f1 = gui.addFolder( '1' );
		const f2 = f1.addFolder( '2' );
		gui.add( { a: 1 }, 'a' );
		f2.add( { b: 1 }, 'b' );
		assert.equal( gui.controllersRecursive().length, 2 );
		assert.deepEqual( gui.foldersRecursive(), [ f1, f2 ] );
		assert.equal( f2.root, gui );
		assert.equal( f2.parent, f1 );

	} );

	it( 'formats numbers with decimals', () => {

		const c = gui.add( { a: 1.23456 }, 'a' ).decimals( 2 );
		assert.equal( c._displayText(), '1.23' );

	} );

	it( 'exposes a DOM stub for addons that poke at domElement', () => {

		gui.domElement.style.right = '0px';
		gui.domElement.addEventListener( 'x', () => {} );
		assert.equal( gui.domElement.style.right, '0px' );

	} );

	it( 'runs function controllers and fires onChange', () => {

		let calls = 0;
		const o = { go() {

			calls ++; return this;

		} };
		const events = [];
		const c = gui.add( o, 'go' ).onChange( () => events.push( 'change' ) );
		c.getValue().call( c.object );
		c._callOnChange();
		assert.equal( calls, 1 );
		assert.deepEqual( events, [ 'change' ] );

	} );

} );

describe( 'lil-gui window', () => {

	let backend;
	let gui;
	let window;
	let o;

	const setup = ( options = {}, scale = 1, displayHeight = 1000 ) => {

		backend = createBackend( scale, displayHeight );
		GUI.backend = backend;
		gui = new GUI( options );
		window = backend.windows[ 0 ];
		o = { n: 5, big: 0.5, flag: false, text: 'hello', mode: 'a', col: '#ff0000', arr: [ 0, 1, 0 ], fn() {

			o.calls = ( o.calls ?? 0 ) + 1;

		} };

	};

	afterEach( () => {

		GUI.destroyAll();
		GUI.backend = null;

	} );

	it( 'opens a window sized to the content', () => {

		setup( { title: 'Panel', width: 300 } );
		assert.equal( backend.windows.length, 1 );
		assert.equal( window.title, 'Panel' );
		assert.equal( window.width, 300 );
		assert.equal( window.height, 25 );
		gui.add( o, 'n' );
		flush( gui );
		assert.deepEqual( window.sizes.at( - 1 ), [ 300, 53 ] );

	} );

	it( 'uses a software renderer so it cannot disturb the OpenGL context of other windows', () => {

		setup();
		assert.equal( window.options.accelerated, false );
		assert.equal( window.options.opengl, undefined );
		assert.equal( window.options.webgpu, undefined );

	} );

	it( 'does not open a window with autoPlace false', () => {

		backend = createBackend();
		GUI.backend = backend;
		new GUI( { autoPlace: false } );
		assert.equal( backend.windows.length, 0 );

	} );

	it( 'shares one window between a gui and its folders', () => {

		setup();
		gui.addFolder( 'a' ).addFolder( 'b' );
		assert.equal( backend.windows.length, 1 );

	} );

	it( 'works without a display', () => {

		const originalWarn = console.warn;
		const warnings = [];
		console.warn = ( ...args ) => warnings.push( args.join( ' ' ) );
		try {

			GUI.backend = { ...createBackend(), createWindow() {

				throw new Error( 'no display' );

			} };
			const g = new GUI();
			const v = { a: 1 };
			g.add( v, 'a' ).setValue( 2 );
			assert.equal( v.a, 2 );
			assert.equal( warnings.length, 1 );
			assert.match( warnings[ 0 ], /no display/ );

		} finally {

			console.warn = originalWarn;

		}

	} );

	it( 'presents RGBA frames at the pixel size', () => {

		setup( {}, 2 );
		gui.add( o, 'n' );
		flush( gui );
		const [ width, height, stride, format, buffer ] = window.renders.at( - 1 );
		assert.equal( width, window.pixelWidth );
		assert.equal( height, window.pixelHeight );
		assert.equal( stride, width * 4 );
		assert.equal( format, 'rgba32' );
		assert.equal( buffer.length, width * height * 4 );
		assert.deepEqual( Array.from( buffer.slice( 0, 4 ) ), [ 0x11, 0x11, 0x11, 255 ] );

	} );

	it( 'draws the title and slider fill in the theme colors', () => {

		setup();
		const c = gui.add( o, 'big', 0, 1 );
		flush( gui );
		const buffer = window.renders.at( - 1 )[ 4 ];
		const stride = window.pixelWidth * 4;
		const slider = c._rects().slider;
		const y = Math.round( slider.y + slider.h / 2 );
		const at = ( x ) => Array.from( buffer.slice( y * stride + x * 4, y * stride + x * 4 + 3 ) );
		assert.deepEqual( at( Math.round( slider.x + slider.w * 0.25 ) ), [ 0x2c, 0xc9, 0xff ] );
		assert.deepEqual( at( Math.round( slider.x + slider.w * 0.75 ) ), [ 0x42, 0x42, 0x42 ] );

	} );

	it( 'drags sliders and fires finish on release', () => {

		setup();
		const events = [];
		const c = gui.add( o, 'big', 0, 1 ).onChange( ( v ) => events.push( [ 'change', v ] ) ).onFinishChange( ( v ) => events.push( [ 'finish', v ] ) );
		flush( gui );
		const slider = c._rects().slider;
		const y = slider.y + 10;
		window.emit( 'mouseMove', { x: slider.x + 1, y, dx: 0, dy: 0 } );
		window.emit( 'mouseButtonDown', { x: slider.x + slider.w * 0.2, y, button: 1 } );
		window.emit( 'mouseMove', { x: slider.x + slider.w * 0.8, y, dx: 0, dy: 0 } );
		window.emit( 'mouseMove', { x: slider.x + slider.w * 3, y: y + 200, dx: 0, dy: 0 } );
		window.emit( 'mouseButtonUp', { x: slider.x + slider.w * 3, y: y + 200, button: 1 } );
		assert.equal( o.big, 1 );
		assert.deepEqual( events.at( - 1 ), [ 'finish', 1 ] );
		assert.equal( events.filter( ( e ) => e[ 0 ] === 'finish' ).length, 1 );
		assert.ok( events.some( ( e ) => e[ 0 ] === 'change' && e[ 1 ] === 0.2 ) );

	} );

	it( 'moves a focused slider with the arrow keys and modifiers', () => {

		setup();
		const c = gui.add( o, 'n', 0, 100, 1 );
		flush( gui );
		click( gui, window, ...center( c._rects().slider ) );
		const start = o.n;
		key( window, 'right' );
		key( window, 'right' );
		key( window, 'left' );
		assert.equal( o.n, start + 1 );
		key( window, 'up', { shift: true } );
		assert.equal( o.n, start + 11 );
		key( window, 'down', { alt: true } );
		assert.equal( o.n, start + 11 );

	} );

	it( 'toggles booleans from the whole row', () => {

		setup();
		const c = gui.add( o, 'flag' );
		flush( gui );
		click( gui, window, c._x + 10, c._y + 10 );
		assert.equal( o.flag, true );
		click( gui, window, c._x + 200, c._y + 10 );
		assert.equal( o.flag, false );

	} );

	it( 'runs function controllers on click and ignores disabled ones', () => {

		setup();
		const c = gui.add( o, 'fn' );
		flush( gui );
		click( gui, window, ...center( c._inner() ) );
		assert.equal( o.calls, 1 );
		c.disable();
		flush( gui );
		click( gui, window, ...center( c._inner() ) );
		assert.equal( o.calls, 1 );
		c.enable();
		flush( gui );
		click( gui, window, ...center( c._inner() ) );
		assert.equal( o.calls, 2 );

	} );

	it( 'edits strings with the keyboard', () => {

		setup();
		const events = [];
		const c = gui.add( o, 'text' ).onFinishChange( ( v ) => events.push( v ) );
		flush( gui );
		click( gui, window, ...center( c._widgetRect() ) );
		assert.notEqual( gui._panel.editing, null );
		key( window, 'a', { ctrl: true } );
		type( window, 'abc' );
		key( window, 'left' );
		key( window, 'backspace' );
		key( window, 'delete' );
		type( window, 'X' );
		assert.equal( o.text, 'aX' );
		key( window, 'return' );
		assert.equal( gui._panel.editing, null );
		assert.deepEqual( events, [ 'aX' ] );

	} );

	it( 'moves the caret by clicking inside the field', () => {

		setup();
		const c = gui.add( o, 'text' );
		flush( gui );
		const rect = c._widgetRect();
		click( gui, window, rect.x + 5, rect.y + 10 );
		const field = gui._panel.editing.field;
		assert.equal( field.caret, 0 );
		click( gui, window, rect.x + rect.w - 3, rect.y + 10 );
		assert.equal( field.caret, 5 );
		key( window, 'home', { shift: false } );
		key( window, 'right', { shift: true } );
		key( window, 'right', { shift: true } );
		assert.equal( field.selectedText, 'he' );
		type( window, 'J' );
		assert.equal( o.text, 'Jllo' );

	} );

	it( 'supports clipboard copy, cut and paste while editing', () => {

		setup();
		const c = gui.add( o, 'text' );
		flush( gui );
		click( gui, window, ...center( c._widgetRect() ) );
		key( window, 'a', { ctrl: true } );
		key( window, 'c', { ctrl: true } );
		assert.equal( backend.clipboardText, 'hello' );
		key( window, 'x', { ctrl: true } );
		assert.equal( o.text, '' );
		backend.clipboardText = 'line1\nline2';
		key( window, 'v', { ctrl: true } );
		assert.equal( o.text, 'line1 line2' );

	} );

	it( 'edits numbers, applying valid text immediately', () => {

		setup();
		const c = gui.add( o, 'n', 0, 10, 1 );
		flush( gui );
		click( gui, window, ...center( c._rects().input ) );
		key( window, 'a', { ctrl: true } );
		type( window, '7' );
		assert.equal( o.n, 7 );
		type( window, 'x' );
		assert.equal( o.n, 7 );
		key( window, 'backspace' );
		key( window, 'backspace' );
		type( window, '99' );
		assert.equal( o.n, 10 );
		key( window, 'up' );
		assert.equal( o.n, 10 );
		key( window, 'down' );
		assert.equal( o.n, 9 );
		key( window, 'return' );
		assert.equal( gui._panel.editing, null );

	} );

	it( 'drags number inputs vertically and edits on a plain click', () => {

		setup();
		const c = gui.add( o, 'n', undefined, undefined, 1 );
		flush( gui );
		assert.equal( c._hasSlider, false );
		const [ x, y ] = center( c._rects().input );
		window.emit( 'mouseMove', { x, y, dx: 0, dy: 0 } );
		window.emit( 'mouseButtonDown', { x, y, button: 1 } );
		window.emit( 'mouseMove', { x, y: y - 5, dx: 0, dy: - 5 } );
		window.emit( 'mouseButtonUp', { x, y: y - 5, button: 1 } );
		assert.ok( o.n > 5 );
		assert.equal( gui._panel.editing, null );
		click( gui, window, x, y );
		assert.notEqual( gui._panel.editing, null );

	} );

	it( 'selects options from a popup and grows the window to fit it', () => {

		setup();
		const c = gui.add( o, 'mode', [ 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h' ] );
		flush( gui );
		const before = window.height;
		click( gui, window, ...center( c._widgetRect() ) );
		assert.notEqual( gui._panel.popup, null );
		assert.ok( window.height > before );
		const widget = c._widgetRect();
		click( gui, window, widget.x + 10, widget.y + widget.h + 2 + 20 * 2 + 5 );
		assert.equal( o.mode, 'c' );
		assert.equal( gui._panel.popup, null );
		flush( gui );
		assert.equal( window.height, before );

	} );

	it( 'closes the option popup with escape or an outside click', () => {

		setup();
		const c = gui.add( o, 'mode', [ 'a', 'b' ] );
		flush( gui );
		click( gui, window, ...center( c._widgetRect() ) );
		key( window, 'escape' );
		assert.equal( gui._panel.popup, null );
		click( gui, window, ...center( c._widgetRect() ) );
		click( gui, window, 5, 5 );
		assert.equal( gui._panel.popup, null );
		assert.equal( o.mode, 'a' );

	} );

	it( 'picks colors from the popup', () => {

		setup();
		const events = [];
		const c = gui.addColor( o, 'col' ).onFinishChange( ( v ) => events.push( v ) );
		flush( gui );
		click( gui, window, ...center( c._rects().swatch ) );
		const popup = gui._panel.popup;
		assert.notEqual( popup, null );
		flush( gui );
		const { sv, hue } = popup.areas();
		window.emit( 'mouseButtonDown', { x: sv.x + sv.w - 0.01, y: sv.y + 0.01, button: 1 } );
		window.emit( 'mouseButtonUp', { x: sv.x + sv.w - 0.01, y: sv.y + 0.01, button: 1 } );
		assert.equal( o.col, '#ff0000' );
		window.emit( 'mouseButtonDown', { x: hue.x + 2, y: hue.y + hue.h / 3, button: 1 } );
		window.emit( 'mouseMove', { x: hue.x + 2, y: hue.y + hue.h * 2 / 3, dx: 0, dy: 0 } );
		window.emit( 'mouseButtonUp', { x: hue.x + 2, y: hue.y + hue.h * 2 / 3, button: 1 } );
		assert.match( o.col, /^#[0-9a-f]{6}$/ );
		assert.notEqual( o.col, '#ff0000' );
		click( gui, window, 3, 3 );
		assert.equal( gui._panel.popup, null );
		assert.deepEqual( events, [ o.col ] );

	} );

	it( 'edits colors by typing hex values', () => {

		setup();
		const c = gui.addColor( o, 'arr' );
		flush( gui );
		click( gui, window, ...center( c._rects().input ) );
		key( window, 'a', { ctrl: true } );
		type( window, '#0000ff' );
		assert.deepEqual( o.arr, [ 0, 0, 1 ] );
		key( window, 'return' );

	} );

	it( 'collapses and expands from the title', () => {

		setup();
		gui.add( o, 'n' );
		flush( gui );
		const open = window.height;
		click( gui, window, 50, 10 );
		assert.equal( gui._closed, true );
		assert.equal( window.height, 25 );
		click( gui, window, 50, 10 );
		assert.equal( gui._closed, false );
		assert.equal( window.height, open );

	} );

	it( 'collapses folders from their title', () => {

		setup();
		const folder = gui.addFolder( 'F' );
		folder.add( o, 'n' );
		flush( gui );
		click( gui, window, 50, folder._y + 10 );
		assert.equal( folder._closed, true );
		flush( gui );
		assert.equal( window.height, 50 );

	} );

	it( 'scrolls when the window is shorter than the content', () => {

		setup( {}, 1, 1000 );
		for ( let i = 0; i < 6; i ++ ) gui.add( { v: i }, 'v' );
		flush( gui );
		window.height = 100;
		flush( gui );
		assert.equal( gui._panel.maxScroll, gui._height() - 100 );
		window.emit( 'mouseWheel', { x: 5, y: 60, dx: 0, dy: - 1, flipped: false } );
		assert.ok( gui._panel.scroll > 0 );
		for ( let i = 0; i < 20; i ++ ) window.emit( 'mouseWheel', { x: 5, y: 60, dx: 0, dy: - 1, flipped: false } );
		assert.equal( gui._panel.scroll, gui._panel.maxScroll );
		window.emit( 'mouseWheel', { x: 5, y: 60, dx: 0, dy: 1, flipped: true } );
		assert.equal( gui._panel.scroll, gui._panel.maxScroll );
		key( window, 'home' );
		assert.equal( gui._panel.scroll, 0 );
		key( window, 'pageDown' );
		assert.ok( gui._panel.scroll > 0 );

	} );

	it( 'hit-tests rows correctly when scrolled', () => {

		setup( {}, 1, 1000 );
		const controllers = [];
		const values = [];
		for ( let i = 0; i < 8; i ++ ) {

			const v = { flag: false };
			values.push( v );
			controllers.push( gui.add( v, 'flag' ) );

		}

		flush( gui );
		window.height = 100;
		flush( gui );
		window.emit( 'mouseWheel', { x: 5, y: 60, dx: 0, dy: - 1, flipped: false } );
		flush( gui );
		const scroll = gui._panel.scroll;
		const target = controllers[ 3 ];
		click( gui, window, target._x + 10, target._y - scroll + 10 );
		assert.deepEqual( values.map( ( v ) => v.flag ), [ false, false, false, true, false, false, false, false ] );

	} );

	it( 'does not scroll a slider that has no focus', () => {

		setup( {}, 1, 1000 );
		const c = gui.add( o, 'n', 0, 10, 1 );
		flush( gui );
		window.emit( 'mouseMove', { x: c._rects().slider.x + 5, y: c._y + 10, dx: 0, dy: 0 } );
		window.emit( 'mouseWheel', { x: c._rects().slider.x + 5, y: c._y + 10, dx: 0, dy: 1, flipped: false } );
		assert.equal( o.n, 5 );
		click( gui, window, ...center( c._rects().slider ) );
		const focused = o.n;
		window.emit( 'mouseWheel', { x: c._rects().slider.x + 5, y: c._y + 10, dx: 0, dy: 1, flipped: false } );
		assert.equal( o.n, focused + 1 );

	} );

	it( 'polls listened controllers and redraws', () => {

		setup();
		const c = gui.add( o, 'n' ).listen();
		flush( gui );
		let updates = 0;
		const original = c.updateDisplay.bind( c );
		c.updateDisplay = () => {

			updates ++; return original();

		};

		gui._panel._pollListeners();
		assert.equal( updates, 0 );
		o.n = 6;
		gui._panel._pollListeners();
		assert.equal( updates, 1 );
		gui._panel._pollListeners();
		assert.equal( updates, 1 );
		c.listen( false );
		o.n = 7;
		gui._panel._pollListeners();
		assert.equal( updates, 1 );

	} );

	it( 'detects in-place color changes when listening', () => {

		setup();
		const c = gui.addColor( o, 'arr' ).listen();
		let updates = 0;
		const original = c.updateDisplay.bind( c );
		c.updateDisplay = () => {

			updates ++; return original();

		};

		o.arr[ 0 ] = 1;
		gui._panel._pollListeners();
		assert.equal( updates, 1 );

	} );

	it( 'shows, hides, retitles and destroys the window', () => {

		setup();
		gui.hide();
		assert.equal( window.visible, false );
		gui.show();
		assert.equal( window.visible, true );
		gui.title( 'New' );
		assert.equal( window.title, 'New' );
		gui.domElement.style.visibility = 'hidden';
		assert.equal( window.visible, false );
		gui.destroy();
		assert.equal( window.destroyed, true );

	} );

	it( 'keeps working after the user closes the window', () => {

		setup();
		const c = gui.add( o, 'n' );
		window.emit( 'close' );
		assert.equal( gui._panel, null );
		c.setValue( 9 );
		assert.equal( o.n, 9 );
		gui.add( o, 'flag' );
		GUI.destroyAll();

	} );

	it( 'destroyAll closes every open window', () => {

		setup();
		const second = new GUI();
		GUI.destroyAll();
		assert.equal( backend.windows.length, 2 );
		assert.ok( backend.windows.every( ( w ) => w.destroyed ) );
		assert.equal( second._panel, null );

	} );

	it( 'forgets destroyed controllers that were being edited', () => {

		setup();
		const c = gui.add( o, 'text' );
		flush( gui );
		click( gui, window, ...center( c._widgetRect() ) );
		c.destroy();
		assert.equal( gui._panel.editing, null );
		flush( gui );

	} );

	it( 'ends editing when focus moves elsewhere', () => {

		setup();
		const text = gui.add( o, 'text' );
		const flag = gui.add( o, 'flag' );
		flush( gui );
		click( gui, window, ...center( text._widgetRect() ) );
		window.emit( 'blur' );
		assert.equal( gui._panel.editing, null );
		click( gui, window, ...center( text._widgetRect() ) );
		click( gui, window, flag._x + 10, flag._y + 10 );
		assert.equal( gui._panel.editing, null );
		assert.equal( o.flag, true );

	} );

	it( 'ignores non-left buttons', () => {

		setup();
		const c = gui.add( o, 'flag' );
		flush( gui );
		window.emit( 'mouseButtonDown', { x: c._x + 10, y: c._y + 10, button: 3 } );
		window.emit( 'mouseButtonUp', { x: c._x + 10, y: c._y + 10, button: 3 } );
		assert.equal( o.flag, false );

	} );

	it( 'uses logical coordinates on high-dpi windows', () => {

		setup( {}, 2 );
		const c = gui.add( o, 'flag' );
		flush( gui );
		assert.equal( gui._panel.canvas.width, window.pixelWidth );
		click( gui, window, c._x + 10, c._y + 10 );
		assert.equal( o.flag, true );

	} );

	it( 'caps the window height to the display and scrolls the rest', () => {

		setup( {}, 1, 200 );
		for ( let i = 0; i < 20; i ++ ) gui.add( { v: i }, 'v' );
		flush( gui );
		assert.equal( window.height, 180 );
		assert.ok( gui._panel.maxScroll > 0 );

	} );

} );
