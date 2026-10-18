import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire( import.meta.url );

let defaultBackend = null;

function escapeCriteria( title ) {

	return title.replace( /"/g, '.' ).replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

}

function createDefaultBackend() {

	const sdl = require( '@kmamal/sdl' );
	const { createCanvas } = require( '@napi-rs/canvas' );

	return {

		createCanvas( width, height ) {

			return createCanvas( width, height );

		},

		createWindow( options ) {

			return sdl.video.createWindow( options );

		},

		getDisplayBounds() {

			const display = sdl.video.displays[ 0 ];

			return display ? display.geometry : { x: 0, y: 0, width: 1920, height: 1080 };

		},

		clipboard: sdl.clipboard,

		floatWindow( title, onAttempt = null ) {

			if ( ! process.env.I3SOCK ) return Promise.resolve();

			const attempts = [ 0, 30, 60, 120, 250, 500 ];

			return Promise.all( attempts.map( ( delay ) => new Promise( ( resolve ) => {

				setTimeout( () => {

					const child = spawn( 'i3-msg', [ `[title="^${ escapeCriteria( title ) }$"] floating enable` ], { stdio: 'ignore' } );

					const done = () => {

						if ( onAttempt !== null ) onAttempt();
						resolve();

					};

					child.on( 'error', done );
					child.on( 'exit', done );

				}, delay );

			} ) ) );

		}

	};

}

function getDefaultBackend() {

	if ( defaultBackend === null ) defaultBackend = createDefaultBackend();

	return defaultBackend;

}

export { getDefaultBackend };
