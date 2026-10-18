import { createRequire } from 'node:module';

const require = createRequire( import.meta.url );

const POINTER_ID = 1;

const DOM_BUTTON = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4 };
const DOM_BUTTONS_MASK = { 1: 1, 2: 4, 3: 2, 4: 8, 5: 16 };

const DOUBLE_CLICK_TIME = 500;
const DOUBLE_CLICK_DISTANCE = 4;

const NAMED_KEYS = {
	left: 'ArrowLeft',
	right: 'ArrowRight',
	up: 'ArrowUp',
	down: 'ArrowDown',
	return: 'Enter',
	enter: 'Enter',
	escape: 'Escape',
	backspace: 'Backspace',
	delete: 'Delete',
	insert: 'Insert',
	tab: 'Tab',
	pageUp: 'PageUp',
	pageDown: 'PageDown',
	home: 'Home',
	end: 'End',
	shift: 'Shift',
	ctrl: 'Control',
	alt: 'Alt',
	option: 'Alt',
	gui: 'Meta',
	windows: 'Meta',
	command: 'Meta',
	capsLock: 'CapsLock',
};

const SCANCODE_CODES = {
	RETURN: 'Enter',
	ESCAPE: 'Escape',
	BACKSPACE: 'Backspace',
	TAB: 'Tab',
	SPACE: 'Space',
	MINUS: 'Minus',
	EQUALS: 'Equal',
	LEFTBRACKET: 'BracketLeft',
	RIGHTBRACKET: 'BracketRight',
	BACKSLASH: 'Backslash',
	NONUSHASH: 'Backslash',
	SEMICOLON: 'Semicolon',
	APOSTROPHE: 'Quote',
	GRAVE: 'Backquote',
	COMMA: 'Comma',
	PERIOD: 'Period',
	SLASH: 'Slash',
	CAPSLOCK: 'CapsLock',
	PRINTSCREEN: 'PrintScreen',
	SCROLLLOCK: 'ScrollLock',
	PAUSE: 'Pause',
	INSERT: 'Insert',
	HOME: 'Home',
	PAGEUP: 'PageUp',
	DELETE: 'Delete',
	END: 'End',
	PAGEDOWN: 'PageDown',
	RIGHT: 'ArrowRight',
	LEFT: 'ArrowLeft',
	DOWN: 'ArrowDown',
	UP: 'ArrowUp',
	NUMLOCKCLEAR: 'NumLock',
	KP_DIVIDE: 'NumpadDivide',
	KP_MULTIPLY: 'NumpadMultiply',
	KP_MINUS: 'NumpadSubtract',
	KP_PLUS: 'NumpadAdd',
	KP_ENTER: 'NumpadEnter',
	KP_PERIOD: 'NumpadDecimal',
	KP_EQUALS: 'NumpadEqual',
	KP_COMMA: 'NumpadComma',
	NONUSBACKSLASH: 'IntlBackslash',
	APPLICATION: 'ContextMenu',
	LCTRL: 'ControlLeft',
	LSHIFT: 'ShiftLeft',
	LALT: 'AltLeft',
	LGUI: 'MetaLeft',
	RCTRL: 'ControlRight',
	RSHIFT: 'ShiftRight',
	RALT: 'AltRight',
	RGUI: 'MetaRight',
};

let scancodeCodes = null;

function toDOMKey( key ) {

	if ( key === null || key === undefined ) return 'Unidentified';
	if ( key in NAMED_KEYS ) return NAMED_KEYS[ key ];
	if ( /^f\d+$/.test( key ) ) return key.toUpperCase();
	return key;

}

function scancodeName( name ) {

	if ( name in SCANCODE_CODES ) return SCANCODE_CODES[ name ];
	if ( /^[A-Z]$/.test( name ) ) return 'Key' + name;
	if ( /^\d$/.test( name ) ) return 'Digit' + name;
	if ( /^F\d+$/.test( name ) ) return name;
	if ( /^KP_\d$/.test( name ) ) return 'Numpad' + name.slice( 3 );
	return '';

}

function toDOMCode( scancode ) {

	if ( scancodeCodes === null ) {

		scancodeCodes = new Map();

		for ( const [ name, value ] of Object.entries( require( '@kmamal/sdl' ).keyboard.SCANCODE ) ) {

			scancodeCodes.set( value, scancodeName( name ) );

		}

	}

	return scancodeCodes.get( scancode ) ?? '';

}

function createEvent( type, target, properties ) {

	const event = new Event( type, { bubbles: true, cancelable: true } );
	Object.assign( event, properties );
	Object.defineProperty( event, 'target', { value: target, configurable: true } );
	Object.defineProperty( event, 'srcElement', { value: target, configurable: true } );

	let stopped = false;
	const { stopPropagation, stopImmediatePropagation } = event;

	event.stopPropagation = function () {

		stopped = true;
		stopPropagation.call( this );

	};

	event.stopImmediatePropagation = function () {

		stopped = true;
		stopImmediatePropagation.call( this );

	};

	event.isStopped = () => stopped;

	return event;

}

function emit( canvas, type, properties ) {

	const document = canvas.ownerDocument;
	const target = document.pointerLockElement ?? canvas;
	const event = createEvent( type, target, properties );
	const path = target === canvas ? [ canvas, document, document.defaultView ] : [ target, canvas, document, document.defaultView ];

	for ( const node of path ) {

		node.dispatchEvent( event );
		if ( event.isStopped() ) break;

	}

	return event;

}

function bindWindowEvents( canvas, window ) {

	let buttons = 0;
	let compatibilityMouse = true;
	let lastClick = null;
	const modifiers = { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false };

	const updateModifiers = ( event ) => {

		modifiers.shiftKey = event.shift === true;
		modifiers.ctrlKey = event.ctrl === true;
		modifiers.altKey = event.alt === true;
		modifiers.metaKey = event.super === true;

	};

	const pointerProperties = ( event, button ) => ( {
		pointerId: POINTER_ID,
		pointerType: event.touch ? 'touch' : event.pen ? 'pen' : 'mouse',
		isPrimary: true,
		clientX: event.x,
		clientY: event.y,
		pageX: event.x,
		pageY: event.y,
		offsetX: event.x,
		offsetY: event.y,
		screenX: event.x,
		screenY: event.y,
		x: event.x,
		y: event.y,
		movementX: event.dx ?? 0,
		movementY: event.dy ?? 0,
		button,
		buttons,
		...modifiers,
	} );

	const isDoubleClick = ( event, button ) => {

		const now = performance.now();
		const previous = lastClick;
		lastClick = { time: now, x: event.x, y: event.y, button };

		if ( previous === null || previous.button !== button ) return false;
		if ( now - previous.time > DOUBLE_CLICK_TIME ) return false;
		if ( Math.hypot( event.x - previous.x, event.y - previous.y ) > DOUBLE_CLICK_DISTANCE ) return false;

		lastClick = null;
		return true;

	};

	const handlers = {

		mouseButtonDown( event ) {

			const button = DOM_BUTTON[ event.button ] ?? 0;
			const first = buttons === 0;
			buttons |= DOM_BUTTONS_MASK[ event.button ] ?? 0;

			const pointerEvent = emit( canvas, 'pointerdown', pointerProperties( event, button ) );
			if ( first ) compatibilityMouse = pointerEvent.defaultPrevented === false;

			if ( compatibilityMouse ) emit( canvas, 'mousedown', pointerProperties( event, button ) );
			if ( button === 2 ) emit( canvas, 'contextmenu', pointerProperties( event, button ) );

		},

		mouseButtonUp( event ) {

			const button = DOM_BUTTON[ event.button ] ?? 0;
			buttons &= ~ ( DOM_BUTTONS_MASK[ event.button ] ?? 0 );

			emit( canvas, 'pointerup', pointerProperties( event, button ) );

			if ( compatibilityMouse ) emit( canvas, 'mouseup', pointerProperties( event, button ) );

			if ( button === 0 ) {

				emit( canvas, 'click', pointerProperties( event, button ) );
				if ( isDoubleClick( event, button ) ) emit( canvas, 'dblclick', pointerProperties( event, button ) );

			} else {

				emit( canvas, 'auxclick', pointerProperties( event, button ) );

			}

			if ( buttons === 0 ) compatibilityMouse = true;

		},

		mouseMove( event ) {

			emit( canvas, 'pointermove', pointerProperties( event, - 1 ) );
			if ( compatibilityMouse ) emit( canvas, 'mousemove', pointerProperties( event, - 1 ) );

		},

		mouseWheel( event ) {

			const sign = event.flipped ? - 1 : 1;

			emit( canvas, 'wheel', {
				...pointerProperties( event, 0 ),
				deltaX: - event.dx * sign * 100,
				deltaY: - event.dy * sign * 100,
				deltaZ: 0,
				deltaMode: 0,
			} );

		},

		keyDown( event ) {

			updateModifiers( event );

			const key = toDOMKey( event.key );

			emit( canvas, 'keydown', {
				key,
				code: toDOMCode( event.scancode ),
				repeat: event.repeat === true,
				...modifiers,
			} );

			if ( key === 'Escape' && canvas.ownerDocument.pointerLockElement !== null ) canvas.ownerDocument.exitPointerLock();

		},

		keyUp( event ) {

			updateModifiers( event );

			emit( canvas, 'keyup', {
				key: toDOMKey( event.key ),
				code: toDOMCode( event.scancode ),
				repeat: false,
				...modifiers,
			} );

		},

		blur() {

			if ( canvas.ownerDocument.pointerLockElement !== null ) canvas.ownerDocument.exitPointerLock();

			if ( buttons === 0 ) return;

			buttons = 0;
			compatibilityMouse = true;
			emit( canvas, 'pointercancel', { pointerId: POINTER_ID, pointerType: 'mouse', isPrimary: true, buttons } );

		},

	};

	for ( const [ name, handler ] of Object.entries( handlers ) ) window.on( name, handler );

	return () => {

		for ( const [ name, handler ] of Object.entries( handlers ) ) window.off( name, handler );

	};

}

export { bindWindowEvents };
