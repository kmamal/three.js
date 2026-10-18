import { createRequire } from 'node:module';

const require = createRequire( import.meta.url );

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const DOCUMENT_NODE = 9;

let patched = false;

const isTag = ( node ) => node.nodeType === ELEMENT_NODE;

const childrenOf = ( node ) => {

	const children = [];
	for ( let child = node.firstChild; child; child = child.nextSibling ) children.push( child );
	return children;

};

const getText = ( node ) => {

	if ( Array.isArray( node ) ) return node.map( getText ).join( '' );
	if ( isTag( node ) ) return getText( childrenOf( node ) );
	return node.nodeType === TEXT_NODE ? node.data : '';

};

const existsOne = ( test, elements ) => elements.some( ( element ) => isTag( element ) && ( test( element ) || existsOne( test, childrenOf( element ) ) ) );

const findAll = ( test, nodes ) => {

	const matches = [];

	for ( const node of nodes ) {

		if ( ! isTag( node ) ) continue;
		if ( test( node ) ) matches.push( node );

		for ( const inner of findAll( test, childrenOf( node ) ) ) matches.push( inner );

	}

	return matches;

};

const findOne = ( test, nodes ) => {

	for ( const node of nodes ) {

		if ( ! isTag( node ) ) continue;
		if ( test( node ) ) return node;
		const inner = findOne( test, childrenOf( node ) );
		if ( inner ) return inner;

	}

	return null;

};

const removeSubsets = ( nodes ) => {

	const all = new Set( nodes );
	const kept = new Set();

	for ( const node of nodes ) {

		let covered = false;

		for ( let parent = node.parentNode; parent; parent = parent.parentNode ) {

			if ( all.has( parent ) ) {

				covered = true;
				break;

			}

		}

		if ( ! covered ) kept.add( node );

	}

	nodes.length = 0;
	for ( const node of kept ) nodes.push( node );

	return nodes;

};

const adapter = {
	isTag,
	existsOne,
	findAll,
	findOne,
	removeSubsets,
	getText,
	getChildren: childrenOf,
	getParent: ( node ) => node.parentNode,
	getSiblings: ( node ) => node.parentNode ? childrenOf( node.parentNode ) : [ node ],
	getName: ( element ) => element.localName ?? element.tagName,
	hasAttrib: ( element, name ) => element.hasAttribute( name ),
	getAttributeValue: ( element, name ) => element.getAttribute( name ) ?? undefined,
};

const documentOf = ( node ) => node.nodeType === DOCUMENT_NODE ? node : node.ownerDocument;

const selectorOptions = ( node ) => ( { xmlMode: ! /html/i.test( documentOf( node ).contentType ?? '' ), relativeSelector: false, adapter } );

function viewportOf( element ) {

	for ( let parent = element.parentNode; parent; parent = parent.parentNode ) {

		if ( parent.nodeType === ELEMENT_NODE && parent.localName === 'svg' ) return parent;

	}

	return null;

}

function createStyle( declaration ) {

	const toProperty = ( name ) => name.replace( /[A-Z]/g, ( letter ) => `-${letter.toLowerCase()}` );

	return new Proxy( declaration, {
		get( target, name ) {

			if ( typeof name !== 'string' ) return target[ name ];
			if ( name in target ) return target[ name ];
			return target.getPropertyValue( toProperty( name ) );

		},
		set( target, name, value ) {

			if ( typeof name === 'string' ) target.setProperty( toProperty( name ), value );
			return true;

		}
	} );

}

const elementSibling = ( node, direction ) => {

	for ( let sibling = node[ direction ]; sibling; sibling = sibling[ direction ] ) if ( sibling.nodeType === ELEMENT_NODE ) return sibling;
	return null;

};

function patch() {

	if ( patched ) return;
	patched = true;

	const { Element, Document, NamedNodeMap } = require( '@xmldom/xmldom' );
	const { selectAll, selectOne, is } = require( 'css-select' );
	const cssom = require( 'cssom' );

	for ( const prototype of [ Element.prototype, Document.prototype ] ) {

		Object.defineProperties( prototype, {
			querySelectorAll: {
				value( selector ) {

					return selectAll( selector, this, selectorOptions( this ) );

				},
				configurable: true,
				writable: true
			},
			querySelector: {
				value( selector ) {

					return selectOne( selector, this, selectorOptions( this ) );

				},
				configurable: true,
				writable: true
			},
		} );

	}

	Object.setPrototypeOf( NamedNodeMap.prototype, new Proxy( Object.getPrototypeOf( NamedNodeMap.prototype ), {
		get( target, name, receiver ) {

			if ( typeof name !== 'string' || name in target ) return Reflect.get( target, name, receiver );
			return receiver.getNamedItem( name ) ?? undefined;

		}
	} ) );

	const styles = new WeakMap();

	for ( const prototype of [ Element.prototype, Document.prototype ] ) {

		Object.defineProperties( prototype, {
			firstElementChild: {
				get() {

					for ( let child = this.firstChild; child; child = child.nextSibling ) if ( child.nodeType === ELEMENT_NODE ) return child;
					return null;

				},
				configurable: true
			},
			lastElementChild: {
				get() {

					for ( let child = this.lastChild; child; child = child.previousSibling ) if ( child.nodeType === ELEMENT_NODE ) return child;
					return null;

				},
				configurable: true
			},
			childElementCount: {
				get() {

					let count = 0;
					for ( let child = this.firstChild; child; child = child.nextSibling ) if ( child.nodeType === ELEMENT_NODE ) count ++;
					return count;

				},
				configurable: true
			},
		} );

	}

	Object.defineProperties( Element.prototype, {
		id: {
			get() {

				return this.getAttribute( 'id' ) ?? '';

			},
			set( value ) {

				this.setAttribute( 'id', value );

			},
			configurable: true
		},
		className: {
			get() {

				return this.getAttribute( 'class' ) ?? '';

			},
			set( value ) {

				this.setAttribute( 'class', value );

			},
			configurable: true
		},
		nextElementSibling: {
			get() {

				return elementSibling( this, 'nextSibling' );

			},
			configurable: true
		},
		previousElementSibling: {
			get() {

				return elementSibling( this, 'previousSibling' );

			},
			configurable: true
		},
		matches: {
			value( selector ) {

				return is( this, selector, selectorOptions( this ) );

			},
			configurable: true,
			writable: true
		},
		style: {
			get() {

				const text = this.getAttribute( 'style' ) ?? '';
				const cached = styles.get( this );
				if ( cached && cached.text === text ) return cached.style;

				const rule = cssom.parse( `x{${text}}` ).cssRules[ 0 ];
				const style = createStyle( rule ? rule.style : new cssom.CSSStyleDeclaration() );
				styles.set( this, { text, style } );
				return style;

			},
			configurable: true
		},
		sheet: {
			get() {

				return this.localName === 'style' ? cssom.parse( this.textContent ) : undefined;

			},
			configurable: true
		},
		viewportElement: {
			get() {

				return this.namespaceURI === SVG_NAMESPACE ? viewportOf( this ) : undefined;

			},
			configurable: true
		},
		ownerSVGElement: {
			get() {

				return this.namespaceURI === SVG_NAMESPACE ? viewportOf( this ) : undefined;

			},
			configurable: true
		},
		getElementById: {
			get() {

				if ( this.namespaceURI !== SVG_NAMESPACE || this.localName !== 'svg' ) return undefined;

				return ( id ) => {

					const stack = [ ...childrenOf( this ) ].reverse();

					while ( stack.length > 0 ) {

						const node = stack.pop();
						if ( ! isTag( node ) ) continue;
						if ( node.getAttribute( 'id' ) === id ) return node;
						stack.push( ...childrenOf( node ).reverse() );

					}

					return null;

				};

			},
			configurable: true
		},
	} );

}

class SDLDOMParser {

	constructor() {

		patch();

		this._parser = new ( require( '@xmldom/xmldom' ).DOMParser )( {
			onError( level, message ) {

				if ( level === 'fatalError' ) throw new Error( message );

			}
		} );

	}

	parseFromString( text, mimeType ) {

		return this._parser.parseFromString( text, mimeType );

	}

}

export { SDLDOMParser };
