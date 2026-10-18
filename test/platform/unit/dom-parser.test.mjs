import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SDLDOMParser } from '../../../src/platform/sdl/SDLDOMParser.js';

const CORE = 'http://schemas.example.com/core';
const MATERIAL = 'http://schemas.example.com/material';

const parentName = ( element ) => element.parentElement.nodeName;

const parse = ( xml, type = 'application/xml' ) => new SDLDOMParser().parseFromString( xml, type );

const MODEL = `<model xmlns="${CORE}" xmlns:m="${MATERIAL}" xml:lang="en">
  <resources>
    <m:colorgroup id="2"><m:color color="#fff"/><m:color color="#000"/></m:colorgroup>
    <object id="1" m:flag="yes" plain="no"/>
  </resources>
</model>`;

describe( 'XML namespace support', () => {

	it( 'exposes attributes as named properties of the attribute map', () => {

		const element = parse( MODEL ).getElementsByTagName( 'object' )[ 0 ];
		assert.equal( element.attributes.id.textContent, '1' );
		assert.equal( element.attributes.plain.value, 'no' );
		assert.equal( element.attributes.missing, undefined );
		assert.equal( element.attributes.length, 3 );
		assert.equal( typeof element.attributes.getNamedItem, 'function' );

	} );

	it( 'reflects the id and class attributes as properties', () => {

		const element = parse( '<r><i id="a" class="x y"/><i/></r>' ).getElementsByTagName( 'i' )[ 0 ];
		assert.equal( element.id, 'a' );
		assert.equal( element.className, 'x y' );
		const bare = parse( '<r><i/></r>' ).getElementsByTagName( 'i' )[ 0 ];
		assert.equal( bare.id, '' );
		bare.id = 'z';
		assert.equal( bare.getAttribute( 'id' ), 'z' );

	} );

	it( 'supports the element traversal accessors', () => {

		const root = parse( '<r>text<a/>more<b/><!-- c --><c/></r>' ).documentElement;
		assert.equal( root.firstElementChild.nodeName, 'a' );
		assert.equal( root.lastElementChild.nodeName, 'c' );
		assert.equal( root.childElementCount, 3 );
		const a = root.firstElementChild;
		assert.equal( a.nextElementSibling.nodeName, 'b' );
		assert.equal( a.previousElementSibling, null );
		assert.equal( a.nextElementSibling.nextElementSibling.nodeName, 'c' );
		assert.equal( root.lastElementChild.nextElementSibling, null );
		assert.equal( parentName( a ), 'r' );

	} );

	it( 'exposes the prefix and keeps the qualified name intact', () => {

		const element = parse( MODEL ).getElementsByTagName( 'm:colorgroup' )[ 0 ];
		assert.equal( element.nodeName, 'm:colorgroup' );
		assert.equal( element.tagName, 'm:colorgroup' );
		assert.equal( element.prefix, 'm' );

	} );

	it( 'reports no prefix for default-namespace elements', () => {

		const element = parse( MODEL ).getElementsByTagName( 'object' )[ 0 ];
		assert.equal( element.prefix, null );

	} );

	it( 'serializes elements with their prefix', () => {

		const element = parse( MODEL ).getElementsByTagName( 'm:colorgroup' )[ 0 ];
		assert.match( element.toString(), /^<m:colorgroup id="2"/ );
		assert.match( element.toString(), /<m:color color="#fff"\/>/ );

	} );

	it( 'resolves namespace URIs from xmlns declarations', () => {

		const document = parse( MODEL );
		assert.equal( document.documentElement.namespaceURI, CORE );
		assert.equal( document.getElementsByTagName( 'm:colorgroup' )[ 0 ].namespaceURI, MATERIAL );
		assert.equal( document.getElementsByTagName( 'object' )[ 0 ].namespaceURI, CORE );

	} );

	it( 'lets inner declarations override outer ones', () => {

		const document = parse( '<a xmlns:p="urn:outer"><p:x/><b xmlns:p="urn:inner"><p:x/></b></a>' );
		const [ outer, inner ] = document.getElementsByTagNameNS( '*', 'x' );
		assert.equal( outer.namespaceURI, 'urn:outer' );
		assert.equal( inner.namespaceURI, 'urn:inner' );

	} );

	it( 'leaves elements without a namespace unqualified', () => {

		const element = parse( '<root><child/></root>' ).getElementsByTagName( 'child' )[ 0 ];
		assert.equal( element.namespaceURI, null );

	} );

	it( 'finds elements by namespace and local name', () => {

		const document = parse( MODEL );
		assert.equal( document.getElementsByTagNameNS( MATERIAL, 'color' ).length, 2 );
		assert.equal( document.getElementsByTagNameNS( CORE, 'color' ).length, 0 );
		assert.equal( document.getElementsByTagNameNS( CORE, 'object' ).length, 1 );
		assert.equal( document.getElementsByTagNameNS( '*', 'color' ).length, 2 );
		assert.equal( document.getElementsByTagNameNS( MATERIAL, '*' ).length, 3 );

	} );

	it( 'searches only below the element for element-level queries', () => {

		const document = parse( MODEL );
		const group = document.getElementsByTagName( 'm:colorgroup' )[ 0 ];
		assert.equal( group.getElementsByTagNameNS( MATERIAL, 'color' ).length, 2 );
		assert.equal( group.getElementsByTagNameNS( CORE, 'object' ).length, 0 );

	} );

	it( 'matches type selectors against the local name, like a browser', () => {

		const document = parse( MODEL );
		assert.equal( document.querySelectorAll( 'colorgroup' ).length, 1 );
		assert.equal( document.querySelectorAll( 'color' ).length, 2 );
		assert.equal( document.querySelectorAll( 'resources > colorgroup > color' ).length, 2 );
		assert.equal( document.querySelector( 'colorgroup' ).getAttribute( 'id' ), '2' );
		assert.equal( document.querySelector( 'missing' ), null );

	} );

	it( 'supports attribute selectors and element-level queries', () => {

		const document = parse( MODEL );
		assert.equal( document.querySelectorAll( '[id="2"]' ).length, 1 );
		assert.equal( document.querySelector( 'object[id="1"]' ).getAttribute( 'plain' ), 'no' );
		const group = document.querySelector( 'colorgroup' );
		assert.equal( group.querySelectorAll( 'color' ).length, 2 );
		assert.equal( group.querySelectorAll( 'object' ).length, 0 );
		assert.equal( group.matches( 'colorgroup' ), true );
		assert.equal( group.matches( 'object' ), false );

	} );

	it( 'keeps selectors case sensitive, as XML requires', () => {

		const document = parse( '<root><Item/><item/></root>' );
		assert.equal( document.querySelectorAll( 'item' ).length, 1 );
		assert.equal( document.querySelectorAll( 'Item' ).length, 1 );

	} );

	it( 'keeps getElementsByTagName matching the qualified name', () => {

		const document = parse( MODEL );
		assert.equal( document.getElementsByTagName( 'colorgroup' ).length, 0 );
		assert.equal( document.getElementsByTagName( 'm:colorgroup' ).length, 1 );

	} );

	it( 'reads namespaced attributes', () => {

		const element = parse( MODEL ).getElementsByTagName( 'object' )[ 0 ];
		assert.equal( element.getAttributeNS( MATERIAL, 'flag' ), 'yes' );
		assert.equal( element.getAttributeNS( null, 'plain' ), 'no' );
		assert.equal( element.getAttributeNS( MATERIAL, 'plain' ), null );
		assert.equal( element.getAttribute( 'm:flag' ), 'yes' );

	} );

	it( 'knows the xml prefix', () => {

		const document = parse( MODEL );
		assert.equal( document.documentElement.getAttributeNS( 'http://www.w3.org/XML/1998/namespace', 'lang' ), 'en' );

	} );

	it( 'handles SVG documents with xlink attributes', () => {

		const document = parse( '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#a"/><g id="a"/></svg>', 'image/svg+xml' );
		const use = document.getElementsByTagName( 'use' )[ 0 ];
		assert.equal( use.namespaceURI, 'http://www.w3.org/2000/svg' );
		assert.equal( use.getAttribute( 'xlink:href' ), '#a' );
		assert.equal( use.getAttributeNS( 'http://www.w3.org/1999/xlink', 'href' ), '#a' );
		assert.ok( document.getElementById( 'a' ) );

	} );

	it( 'gives SVG elements a viewport element with getElementById', () => {

		const document = parse( '<svg xmlns="http://www.w3.org/2000/svg"><defs><path id="a"/></defs><g><use id="u"/></g></svg>', 'image/svg+xml' );
		const use = document.getElementsByTagName( 'use' )[ 0 ];
		const svg = document.documentElement;
		assert.equal( use.viewportElement, svg );
		assert.equal( use.ownerSVGElement, svg );
		assert.equal( svg.viewportElement, null );
		assert.equal( svg.getElementById( 'a' ).tagName, 'path' );
		assert.equal( svg.getElementById( 'missing' ), null );

	} );

	it( 'does not add SVG members to elements of other namespaces', () => {

		const element = parse( '<root><item/></root>' ).getElementsByTagName( 'item' )[ 0 ];
		assert.equal( element.viewportElement, undefined );

	} );

	it( 'supports inline styles on SVG elements', () => {

		const document = parse( '<svg xmlns="http://www.w3.org/2000/svg"><path id="p" style="fill:none;stroke-width:3"/></svg>', 'image/svg+xml' );
		const { style } = document.getElementById( 'p' );
		assert.equal( style.fill, 'none' );

	} );

	it( 'leaves HTML documents alone', () => {

		const document = parse( '<html><body><p id="x">hi</p></body></html>', 'text/html' );
		assert.equal( document.getElementById( 'x' ).textContent, 'hi' );

	} );

	it( 'raises a clear error for malformed documents', () => {

		assert.throws( () => parse( '<?xml version="1.0"?>' ), /missing root element/ );
		assert.throws( () => parse( '<a><b></a>' ), /Error/ );

	} );

} );

describe( 'selector performance', () => {

	it( 'queries documents with many siblings in linear time', () => {

		const count = 60000;
		const doc = parse( `<r>${'<item class="a"><leaf/></item>'.repeat( count )}</r>` );
		const root = doc.documentElement;
		const start = performance.now();
		assert.equal( root.querySelectorAll( 'item' ).length, count );
		assert.equal( root.querySelectorAll( 'item > leaf' ).length, count );
		assert.equal( root.querySelectorAll( '.a' ).length, count );
		assert.ok( performance.now() - start < 3000, 'selector queries over many siblings should not be quadratic' );

	} );

	it( 'returns nested matches once and in document order', () => {

		const doc = parse( '<r><a id="1"><a id="2"><a id="3"/></a></a><a id="4"/></r>' );
		assert.deepEqual( [ ...doc.querySelectorAll( 'a' ) ].map( ( node ) => node.getAttribute( 'id' ) ), [ '1', '2', '3', '4' ] );
		assert.deepEqual( [ ...doc.documentElement.querySelectorAll( 'a a' ) ].map( ( node ) => node.getAttribute( 'id' ) ), [ '2', '3' ] );

	} );

} );
