import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire( import.meta.url );
const wasmBinary = fs.readFileSync( new URL( './ammo.wasm.wasm', import.meta.url ) );
const Ammo = require( './ammo.wasm.cjs' );

globalThis.Ammo = ( options ) => Ammo( { wasmBinary, ...options } );
