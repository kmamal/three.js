import { Worker as ThreadWorker } from 'node:worker_threads';
import { resolveObjectURL } from 'node:buffer';
import { sdlFetch } from './SDLFetch.js';

const PRELUDE = `
const { parentPort } = require( 'node:worker_threads' );
globalThis.self = globalThis;
globalThis.postMessage = ( data, transfer ) => parentPort.postMessage( data, transfer );
globalThis.close = () => process.exit( 0 );
globalThis.importScripts = () => { throw new Error( 'importScripts() is not supported' ); };
let messageHandler = null;
Object.defineProperty( globalThis, 'onmessage', { get: () => messageHandler, set: ( handler ) => { messageHandler = handler; } } );
globalThis.addEventListener = ( type, handler ) => {
	if ( type === 'message' ) parentPort.on( 'message', ( data ) => handler( { data } ) );
};
parentPort.on( 'message', ( data ) => { if ( messageHandler !== null ) messageHandler( { data } ); } );
`;

async function readSource( source ) {

	if ( source.startsWith( 'blob:' ) ) {

		const blob = resolveObjectURL( source );
		if ( blob === undefined ) throw new Error( `Worker source "${source}" was not found` );
		return blob.text();

	}

	const response = await sdlFetch( source );
	if ( response.status !== 200 ) throw new Error( `Failed to load worker "${source}" (${response.status})` );
	return response.text();

}

class SDLWorker extends EventTarget {

	constructor( source ) {

		super();

		this.onmessage = null;
		this.onerror = null;
		this._thread = null;
		this._queue = [];
		this._terminated = false;

		this._start( String( source ) );

	}

	async _start( source ) {

		try {

			const code = await readSource( source );

			if ( this._terminated ) return;

			this._thread = new ThreadWorker( PRELUDE + code, { eval: true } );

			this._thread.on( 'message', ( data ) => {

				this._emit( 'message', new MessageEvent( 'message', { data } ), 'onmessage' );

			} );

			this._thread.on( 'error', ( error ) => this._fail( error ) );

			for ( const data of this._queue ) this._thread.postMessage( data );
			this._queue.length = 0;

		} catch ( error ) {

			this._fail( error );

		}

	}

	_fail( error ) {

		const event = new Event( 'error' );
		event.error = error;
		event.message = error.message;
		this._emit( 'error', event, 'onerror' );

	}

	_emit( type, event, handlerName ) {

		this.dispatchEvent( event );
		if ( typeof this[ handlerName ] === 'function' ) this[ handlerName ]( event );

	}

	postMessage( data, transfer = [] ) {

		if ( this._terminated ) return;

		if ( this._thread === null ) {

			this._queue.push( structuredClone( data, { transfer } ) );
			return;

		}

		this._thread.postMessage( data, transfer );

	}

	terminate() {

		this._terminated = true;
		this._queue.length = 0;
		if ( this._thread !== null ) this._thread.terminate();

	}

}

export { SDLWorker };
