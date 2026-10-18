import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const nativeFetch = globalThis.fetch;

const REMOTE = /^(https?|data|blob):/i;

const MIME_TYPES = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
	'.gif': 'image/gif',
	'.svg': 'image/svg+xml',
	'.json': 'application/json',
	'.gltf': 'model/gltf+json',
	'.glb': 'model/gltf-binary',
	'.bin': 'application/octet-stream',
	'.txt': 'text/plain',
};

let fetchRoot = null;

function setFetchRoot( root ) {

	fetchRoot = root === null ? null : path.resolve( String( root ) );

}

const respond = async ( filePath ) => {

	const buffer = await fs.readFile( filePath );
	const type = MIME_TYPES[ path.extname( filePath ).toLowerCase() ] ?? 'application/octet-stream';
	return new Response( buffer, { status: 200, headers: { 'content-type': type } } );

};

async function sdlFetch( url, init ) {

	const location = String( url );
	const localLocation = location.replace( /[?#].*$/, '' );

	if ( REMOTE.test( location ) ) return nativeFetch( location, init );

	const isRooted = fetchRoot !== null && localLocation.startsWith( '/' ) && ! localLocation.startsWith( '//' );

	let filePath;
	if ( localLocation.startsWith( 'file:' ) ) filePath = fileURLToPath( localLocation );
	else if ( isRooted ) filePath = path.join( fetchRoot, decodeURIComponent( localLocation ) );
	else filePath = path.resolve( decodeURIComponent( localLocation ) );

	try {

		return await respond( filePath );

	} catch ( error ) {

		return new Response( null, { status: error.code === 'ENOENT' ? 404 : 500, statusText: error.message } );

	}

}

export { sdlFetch, setFetchRoot };
