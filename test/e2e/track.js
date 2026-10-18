import fsPromises from 'node:fs/promises';

const quiet = Number( process.env.E2E_QUIET ?? 1500 );
const remoteQuiet = Number( process.env.E2E_REMOTE_QUIET ?? 5000 );
const realNow = () => Number( process.hrtime.bigint() / 1000000n );

let inflight = 0;
let lastActivity = realNow();
let quietNeeded = quiet;

const track = ( original ) => function ( ...args ) {

	inflight ++;
	lastActivity = realNow();

	if ( /^https?:/i.test( String( args[ 0 ]?.url ?? args[ 0 ] ) ) ) quietNeeded = remoteQuiet;

	const done = () => {

		inflight --;
		lastActivity = realNow();

	};

	const result = original.apply( this, args );
	Promise.resolve( result ).then( done, done );
	return result;

};

fsPromises.readFile = track( fsPromises.readFile );
globalThis.fetch = track( globalThis.fetch );

export const isBusy = () => inflight > 0 || realNow() - lastActivity < quietNeeded;
