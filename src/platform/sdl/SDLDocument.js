import path from 'node:path';
import { spawn } from 'node:child_process';
import { animationContext } from './SDLFrames.js';
import { SDLImage } from './SDLImage.js';
import { createCanvas2D } from './SDLCanvas2D.js';

class SDLEventTarget extends EventTarget {

	dispatchEvent( event ) {

		const result = super.dispatchEvent( event );

		const handler = this[ 'on' + event.type ];
		if ( typeof handler === 'function' ) handler.call( this, event );

		return result && event.defaultPrevented === false;

	}

}

function searchFromArguments( args ) {

	const params = new URLSearchParams();

	for ( const arg of args ) {

		if ( arg.startsWith( '-' ) ) continue;

		const index = arg.indexOf( '=' );
		if ( index === - 1 ) params.append( arg, '' );
		else params.append( arg.slice( 0, index ), arg.slice( index + 1 ) );

	}

	const search = params.toString().replace( /=(&|$)/g, '$1' );
	return search === '' ? '' : '?' + search;

}

function argumentsFromSearch( search ) {

	return [ ...new URLSearchParams( search ).entries() ].map( ( [ key, value ] ) => value === '' ? key : `${key}=${value}` );

}

class SDLLocation {

	constructor() {

		const script = process.argv[ 1 ] ?? '';

		this._script = script;
		this._url = new URL( 'file://' + path.resolve( script ) );
		this._url.search = searchFromArguments( process.argv.slice( 2 ) );

	}

	get href() {

		return this._url.href;

	}

	set href( value ) {

		this.assign( value );

	}

	get protocol() {

		return this._url.protocol;

	}

	get origin() {

		return 'file://';

	}

	get host() {

		return '';

	}

	get hostname() {

		return '';

	}

	get pathname() {

		return this._url.pathname;

	}

	get search() {

		return this._url.search;

	}

	set search( value ) {

		const url = new URL( this._url );
		url.search = value;
		this.assign( url.href );

	}

	get hash() {

		return this._url.hash;

	}

	set hash( value ) {

		this._url.hash = value;

	}

	assign( value ) {

		const url = new URL( value, this._url );

		if ( url.protocol !== 'file:' || url.pathname !== this._url.pathname ) {

			throw new Error( `THREE: Navigating to "${url.href}" is not supported under SDL.` );

		}

		if ( url.search === this._url.search && url.hash !== this._url.hash ) {

			this._url.hash = url.hash;
			return;

		}

		this._restart( url.search );

	}

	replace( value ) {

		this.assign( value );

	}

	reload() {

		this._restart( this._url.search );

	}

	_restart( search ) {

		const child = spawn( process.execPath, [ ...process.execArgv, this._script, ...argumentsFromSearch( search ) ], { stdio: 'inherit', detached: true } );
		child.unref();
		process.exit( 0 );

	}

	toString() {

		return this.href;

	}

}

let location = null;

const getLocation = () => location ??= new SDLLocation();

class SDLView extends SDLEventTarget {

	constructor( window ) {

		super();

		this._window = window;
		this.pageXOffset = 0;
		this.pageYOffset = 0;
		this.scrollX = 0;
		this.scrollY = 0;
		this.performance = globalThis.performance;
		this.history = { replaceState() {}, pushState() {} };
		this.navigator = globalThis.navigator;

	}

	get window() {

		return this;

	}

	get self() {

		return this;

	}

	get document() {

		return documents.get( this._window );

	}

	get location() {

		return getLocation();

	}

	set location( value ) {

		getLocation().assign( value );

	}

	get innerWidth() {

		return this._window.width;

	}

	get innerHeight() {

		return this._window.height;

	}

	get devicePixelRatio() {

		return this._window.pixelWidth / this._window.width;

	}

	matchMedia( query ) {

		return { matches: false, media: String( query ), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} };

	}

	requestAnimationFrame( callback ) {

		return animationContext.requestAnimationFrame( callback );

	}

	cancelAnimationFrame( id ) {

		animationContext.cancelAnimationFrame( id );

	}

	alert( message = '' ) {

		console.log( String( message ) );

	}

	confirm( message = '' ) {

		console.log( String( message ) );
		return false;

	}

	prompt( message = '', defaultValue = null ) {

		console.log( String( message ) );
		return defaultValue;

	}

}

const INERT_TAGS = new Set( [ 'div', 'span', 'p', 'a', 'button', 'input', 'label', 'ul', 'ol', 'li', 'br', 'hr', 'small', 'b', 'i', 'pre', 'code', 'section', 'header', 'footer', 'nav', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'select', 'option', 'style', 'body', 'html' ] );

const noted = new Set();

function note( what ) {

	if ( noted.has( what ) ) return;

	noted.add( what );
	console.log( `SDL: ignoring DOM element ${what}` );

}

class SDLElement extends SDLEventTarget {

	constructor( window, tagName, id = '', silent = false ) {

		super();

		this._window = window;
		this.tagName = tagName.toUpperCase();
		this.id = id;
		this.className = '';
		this.style = {};
		this.dataset = {};
		this.children = [];
		this.innerHTML = '';
		this.innerText = '';
		this.textContent = '';
		this.value = '';
		this.checked = false;
		this.disabled = false;
		this.hidden = false;
		this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };

		if ( silent === false ) note( id === '' ? `<${tagName}>` : `#${id}` );

	}

	get ownerDocument() {

		return this._window === null ? null : documents.get( this._window );

	}

	get parentElement() {

		return null;

	}

	get parentNode() {

		return null;

	}

	getRootNode() {

		return this.ownerDocument ?? this;

	}

	get clientLeft() {

		return 0;

	}

	get clientTop() {

		return 0;

	}

	get clientWidth() {

		return this._window?.width ?? 0;

	}

	get clientHeight() {

		return this._window?.height ?? 0;

	}

	get offsetWidth() {

		return this.clientWidth;

	}

	get offsetHeight() {

		return this.clientHeight;

	}

	appendChild( child ) {

		this.children.push( child );
		return child;

	}

	append( ...nodes ) {

		for ( const node of nodes ) this.children.push( node );

	}

	prepend( ...nodes ) {

		this.children.unshift( ...nodes );

	}

	removeChild( child ) {

		const index = this.children.indexOf( child );
		if ( index !== - 1 ) this.children.splice( index, 1 );
		return child;

	}

	remove() {}

	setAttribute( name, value ) {

		this._attributes ??= new Map();
		this._attributes.set( name, String( value ) );

	}

	getAttribute( name ) {

		return this._attributes?.get( name ) ?? null;

	}

	hasAttribute( name ) {

		return this._attributes?.has( name ) ?? false;

	}

	removeAttribute( name ) {

		this._attributes?.delete( name );

	}

	focus() {}

	blur() {}

	click() {

		this.dispatchEvent( new Event( 'click' ) );

	}

	requestPointerLock() {

		this.ownerDocument?._lockPointer( this );

	}

	setPointerCapture() {}

	releasePointerCapture() {}

	getBoundingClientRect() {

		const width = this.clientWidth;
		const height = this.clientHeight;
		return { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 };

	}

	querySelector( selector ) {

		return this.ownerDocument?.querySelector( selector ) ?? new SDLElement( this._window, 'div' );

	}

	querySelectorAll() {

		return [];

	}

}

function createElement( name, window = null ) {

	const tagName = String( name ).toLowerCase();

	if ( tagName === 'img' ) return new SDLImage();
	if ( tagName === 'canvas' ) return createCanvas2D();
	if ( INERT_TAGS.has( tagName ) ) return new SDLElement( window, tagName );

	throw new Error( `THREE: <${name}> elements are not available under SDL.` );

}

class SDLDocument extends SDLEventTarget {

	constructor( window ) {

		super();

		this.hidden = false;
		this.visibilityState = 'visible';
		this.readyState = 'loading';
		this.pointerLockElement = null;
		this.defaultView = new SDLView( window );

		this._window = window;
		this._presented = false;
		this._pendingResize = false;
		this._elements = new Map();

		this.body = new SDLElement( window, 'body', '', true );
		this.documentElement = new SDLElement( window, 'html', '', true );
		this.head = new SDLElement( window, 'head', '', true );

	}

	get ownerDocument() {

		return null;

	}

	get location() {

		return getLocation();

	}

	markPresented() {

		if ( this._presented ) return;

		this._presented = true;

		if ( this._pendingResize ) {

			this._pendingResize = false;
			setImmediate( () => this.defaultView.dispatchEvent( new Event( 'resize' ) ) );

		}

	}

	_load() {

		this.readyState = 'complete';
		this.dispatchEvent( new Event( 'DOMContentLoaded' ) );
		this.defaultView.dispatchEvent( new Event( 'load' ) );

	}

	_lockPointer( element ) {

		if ( this._window.destroyed ) return;

		this._window.setRelativeMouseMode( true );
		this.pointerLockElement = element;
		setImmediate( () => this.dispatchEvent( new Event( 'pointerlockchange' ) ) );

	}

	exitPointerLock() {

		if ( this.pointerLockElement === null ) return;

		if ( ! this._window.destroyed ) this._window.setRelativeMouseMode( false );
		this.pointerLockElement = null;
		setImmediate( () => this.dispatchEvent( new Event( 'pointerlockchange' ) ) );

	}

	getElementById( id ) {

		let element = this._elements.get( id );

		if ( element === undefined ) {

			element = new SDLElement( this._window, 'div', id );
			this._elements.set( id, element );

		}

		return element;

	}

	querySelector( selector ) {

		if ( selector === 'body' ) return this.body;
		if ( selector === 'html' ) return this.documentElement;
		if ( selector === 'head' ) return this.head;

		return this.getElementById( /^#[\w-]+$/.test( selector ) ? selector.slice( 1 ) : selector );

	}

	querySelectorAll() {

		return [];

	}

	createElement( name ) {

		return createElement( name, this._window );

	}

	createElementNS( namespace, name ) {

		return createElement( name, this._window );

	}

}

const documents = new WeakMap();

let primaryDocument = null;

function getPrimaryDocument() {

	if ( primaryDocument !== null && primaryDocument._window.destroyed ) primaryDocument = null;

	return primaryDocument;

}

function getDocument( window ) {

	let document = documents.get( window );

	if ( document === undefined ) {

		document = new SDLDocument( window );
		documents.set( window, document );

		if ( getPrimaryDocument() === null ) primaryDocument = document;

		setImmediate( () => document._load() );

		window.on( 'resize', () => {

			if ( document._presented === false ) {

				document._pendingResize = true;
				return;

			}

			document.defaultView.dispatchEvent( new Event( 'resize' ) );

		} );

		window.on( 'close', () => {

			document.pointerLockElement = null;

		} );

	}

	return document;

}

export { SDLEventTarget, SDLView, SDLDocument, SDLElement, createElement, getDocument, getPrimaryDocument };
