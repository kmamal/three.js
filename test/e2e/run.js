import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { Image } from './image.js';

const root = path.resolve( import.meta.dirname, '../..' );
const examples = path.join( root, 'examples' );
const outDir = path.join( import.meta.dirname, 'output' );
const passedFile = path.join( outDir, 'passed.json' );

const args = process.argv.slice( 2 );
const flags = new Set( args.filter( ( arg ) => arg.startsWith( '--' ) && ! arg.includes( '=' ) ) );
const named = ( name, fallback ) => args.find( ( arg ) => arg.startsWith( `--${name}=` ) )?.split( '=' )[ 1 ] ?? fallback;
const names = args.filter( ( arg ) => ! arg.startsWith( '--' ) ).map( ( arg ) => arg.replace( /\.(html|mjs)$/, '' ) );

const pixelThreshold = Number( named( 'threshold', 0.1 ) );
const maxDifferentPixels = Number( named( 'max-diff', 1 ) );
const timeout = Number( named( 'timeout', 60 ) ) * 1000;
const viewScale = 2;

const exceptions = JSON.parse( fs.readFileSync( path.join( import.meta.dirname, 'exceptions.json' ), 'utf8' ) );
const tolerances = JSON.parse( fs.readFileSync( path.join( import.meta.dirname, 'tolerances.json' ), 'utf8' ) );
const excluded = new Set( Object.values( exceptions ).flat() );
const toleranceOf = ( name ) => tolerances[ name ] ?? maxDifferentPixels;

const red = ( message ) => console.log( `\x1b[31m${message}\x1b[39m` );
const green = ( message ) => console.log( `\x1b[32m${message}\x1b[39m` );
const yellow = ( message ) => console.log( `\x1b[33m${message}\x1b[39m` );

if ( ! flags.has( '--resume' ) ) fs.rmSync( outDir, { recursive: true, force: true } );
fs.mkdirSync( outDir, { recursive: true } );

const passed = new Set( fs.existsSync( passedFile ) ? JSON.parse( fs.readFileSync( passedFile, 'utf8' ) ) : [] );
const savePassed = () => fs.writeFileSync( passedFile, JSON.stringify( [ ...passed ].sort(), null, '\t' ) );

const kill = ( child ) => {

	if ( child.exitCode !== null || child.signalCode !== null ) return Promise.resolve();

	child.kill( 'SIGTERM' );

	return new Promise( ( resolve ) => {

		const timer = setTimeout( () => {

			child.kill( 'SIGKILL' );
			resolve();

		}, 3000 );

		child.once( 'exit', () => {

			clearTimeout( timer );
			resolve();

		} );

	} );

};

const capture = async ( name ) => {

	const captureFile = path.join( outDir, `${name}-raw.png` );

	const child = spawn( process.execPath, [ '--no-deprecation', '--import', path.join( import.meta.dirname, 'inject.js' ), path.join( examples, `${name}.mjs` ) ], {
		cwd: root,
		stdio: [ 'ignore', 'pipe', 'pipe' ],
		env: { ...process.env, E2E: '1', E2E_CAPTURE: captureFile },
	} );

	let log = '';
	let state = null;
	let exited = false;
	let wake = null;

	const onData = ( data ) => {

		log += data;

		if ( state === null ) {

			if ( log.includes( 'E2E_RENDERED' ) ) state = 'rendered';
			else if ( log.includes( 'E2E_CAPPED' ) ) state = 'capped';

		}

		if ( state !== null ) wake?.();

	};

	child.stdout.on( 'data', onData );
	child.stderr.on( 'data', onData );
	child.on( 'exit', () => {

		exited = true;
		wake?.();

	} );

	await new Promise( ( resolve ) => {

		wake = resolve;
		setTimeout( resolve, timeout );
		if ( state !== null || exited ) resolve();

	} );

	await kill( child );

	const lines = log.split( '\n' );
	const errors = lines.filter( ( line ) => line.startsWith( 'E2E_ERROR ' ) || line.startsWith( 'validation:' ) ).map( ( line ) => line.replace( /^E2E_ERROR /, '' ) );

	let image = null;

	if ( fs.existsSync( captureFile ) ) {

		image = await Image.read( captureFile );
		fs.rmSync( captureFile, { force: true } );

	}

	return { image, errors, state, exited, nothing: log.includes( 'E2E_NOTHING_PRESENTED' ), log };

};

const compare = async ( name, image ) => {

	let expected;

	try {

		expected = await Image.read( path.join( examples, 'screenshots', `${name}.jpg` ) );

	} catch {

		throw new Error( `no screenshot for ${name}` );

	}

	const actual = image.scale( 1 / viewScale );

	if ( actual.width !== expected.width || actual.height !== expected.height ) {

		await actual.write( path.join( outDir, `${name}-actual.jpg` ), 95 );
		throw new Error( `size ${actual.width}x${actual.height} != ${expected.width}x${expected.height}` );

	}

	const diff = actual.clone();
	const count = expected.compare( actual, diff, pixelThreshold );
	const percent = count / ( actual.width * actual.height ) * 100;

	if ( percent >= toleranceOf( name ) ) {

		await actual.write( path.join( outDir, `${name}-actual.jpg` ), 95 );
		await expected.write( path.join( outDir, `${name}-expected.jpg` ), 95 );
		await diff.write( path.join( outDir, `${name}-diff.jpg` ), 95 );

	}

	return percent;

};

const all = fs.readdirSync( examples ).filter( ( file ) => file.endsWith( '.mjs' ) ).map( ( file ) => file.slice( 0, - 4 ) ).sort();

let list;
if ( names.length > 0 ) list = names;
else if ( flags.has( '--exceptions' ) ) list = all.filter( ( name ) => excluded.has( name ) );
else list = all.filter( ( name ) => ! excluded.has( name ) );

if ( flags.has( '--webgpu' ) ) list = list.filter( ( name ) => name.includes( 'webgpu_' ) );

const shard = named( 'shard' );

if ( shard ) {

	const [ index, count ] = shard.split( '/' ).map( Number );
	list = list.slice( Math.floor( index * list.length / count ), Math.floor( ( index + 1 ) * list.length / count ) );

}

const failed = [];
const nowPassing = [];

for ( const name of list ) {

	if ( flags.has( '--resume' ) && passed.has( name ) ) continue;

	const started = Date.now();

	try {

		const { image, errors, state, exited, nothing, log } = await capture( name );

		if ( errors.length > 0 ) throw new Error( errors[ 0 ].slice( 0, 200 ) );
		if ( state === null ) throw new Error( exited ? `exited early: ${log.trim().split( '\n' ).pop()}` : 'render timeout' );
		if ( nothing ) throw new Error( 'nothing was presented' );
		if ( image === null ) throw new Error( 'no frame was captured' );

		const percent = await compare( name, image );
		const seconds = ( ( Date.now() - started ) / 1000 ).toFixed( 1 );
		const capped = state === 'capped' ? ', capped' : '';

		if ( percent >= toleranceOf( name ) ) throw new Error( `diff wrong in ${percent.toFixed( 1 )}% of pixels${capped}` );

		green( `diff ${percent.toFixed( 1 )}% in ${name} (${seconds}s${capped})` );
		passed.add( name );
		savePassed();

		if ( excluded.has( name ) ) nowPassing.push( name );

	} catch ( error ) {

		red( `${name}: ${error.message}` );
		failed.push( name );
		if ( flags.has( '--bail' ) ) break;

	}

}

if ( nowPassing.length > 0 ) yellow( `Listed in exceptions.json but passing: ${nowPassing.join( ' ' )}` );

if ( failed.length > 0 && ! flags.has( '--exceptions' ) ) {

	red( `FAILED ${failed.length} of ${list.length}: ${failed.join( ' ' )}` );
	process.exit( 1 );

}

green( `PASSED ${list.length - failed.length} of ${list.length} screenshots` );
