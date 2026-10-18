import path from 'node:path';
import { platform, setPlatform } from '../../src/platform/Platform.js';

const root = path.resolve( import.meta.dirname, '../..' );

const nativeFetch = globalThis.fetch;

platform.setFetchRoot( root );

globalThis.fetch = ( url, init ) => /^(https?|data|blob):/i.test( String( url ) ) ? nativeFetch( url, init ) : platform.fetch( url, init );

globalThis.document ??= { createElement: ( name ) => platform.createElement( name ) };
globalThis.ImageBitmap ??= platform.ImageBitmap;

const audioContexts = [];
const getAudioContext = Object.getOwnPropertyDescriptor( platform, 'AudioContext' ).get;
let TrackedAudioContext = null;

setPlatform( {

	get AudioContext() {

		TrackedAudioContext ??= class extends getAudioContext.call( platform ) {

			constructor( ...args ) {

				super( ...args );
				audioContexts.push( this );

			}

		};

		return TrackedAudioContext;

	}

} );

QUnit.done( async () => {

	for ( const context of audioContexts ) await context.close();

} );
