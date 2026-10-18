import { createRequire } from 'node:module';

const require = createRequire( import.meta.url );

export const DEFAULT_METADATA = {
	version: '1.0',
	gainMapMin: 0,
	gainMapMax: 2,
	gamma: 1,
	offsetSDR: 0,
	offsetHDR: 0,
	hdrCapacityMin: 0,
	hdrCapacityMax: 2,
};

const xmpPacket = ( meta ) => `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:hdrgm="http://ns.adobe.com/hdr-gain-map/1.0/" hdrgm:Version="${meta.version}" hdrgm:GainMapMin="${meta.gainMapMin}" hdrgm:GainMapMax="${meta.gainMapMax}" hdrgm:Gamma="${meta.gamma}" hdrgm:OffsetSDR="${meta.offsetSDR}" hdrgm:OffsetHDR="${meta.offsetHDR}" hdrgm:HDRCapacityMin="${meta.hdrCapacityMin}" hdrgm:HDRCapacityMax="${meta.hdrCapacityMax}" hdrgm:BaseRenditionIsHDR="False"/></rdf:RDF></x:xmpmeta>`;

const segment = ( marker, payload ) => {

	const out = Buffer.alloc( 4 + payload.length );
	out[ 0 ] = 0xff;
	out[ 1 ] = marker;
	out.writeUInt16BE( 2 + payload.length, 2 );
	payload.copy( out, 4 );
	return out;

};

const mpfPayload = ( { primarySize, gainSize, gainOffset, littleEndian } ) => {

	const body = Buffer.alloc( 4 + 4 + 4 + 2 + 36 + 4 + 32 );
	const u16 = ( value, at ) => ( littleEndian ? body.writeUInt16LE( value, at ) : body.writeUInt16BE( value, at ) );
	const u32 = ( value, at ) => ( littleEndian ? body.writeUInt32LE( value, at ) : body.writeUInt32BE( value, at ) );
	body.write( 'MPF\0', 0, 'latin1' );
	Buffer.from( littleEndian ? [ 0x49, 0x49, 0x2a, 0x00 ] : [ 0x4d, 0x4d, 0x00, 0x2a ] ).copy( body, 4 );
	u32( 8, 8 );
	u16( 3, 12 );
	let at = 14;
	const entry = ( tag, type, count, value ) => {

		u16( tag, at );
		u16( type, at + 2 );
		u32( count, at + 4 );
		if ( typeof value === 'string' ) body.write( value, at + 8, 'latin1' );
		else u32( value, at + 8 );
		at += 12;

	};

	entry( 0xb000, 7, 4, '0100' );
	entry( 0xb001, 4, 1, 2 );
	entry( 0xb002, 7, 32, 50 );
	u32( 0, at );
	at += 4;
	u32( 0x20030000, at );
	u32( primarySize, at + 4 );
	u32( 0, at + 8 );
	at += 16;
	u32( 0, at );
	u32( gainSize, at + 4 );
	u32( gainOffset, at + 8 );
	return body;

};

export const buildUltraHDR = async ( {
	width = 64,
	height = 32,
	sdr = [ 128, 128, 128 ],
	gainLeft = 0,
	gainRight = 255,
	gainWidth = width,
	gainHeight = height,
	meta = {},
	littleEndian = false,
} = {} ) => {

	const sharp = require( 'sharp' );
	const metadata = { ...DEFAULT_METADATA, ...meta };

	const sdrPixels = Buffer.alloc( width * height * 3 );
	for ( let i = 0; i < width * height; i ++ ) sdrPixels.set( sdr, i * 3 );
	const sdrJpeg = await sharp( sdrPixels, { raw: { width, height, channels: 3 } } ).jpeg( { quality: 98, chromaSubsampling: '4:4:4' } ).toBuffer();

	const gainPixels = Buffer.alloc( gainWidth * gainHeight );
	for ( let y = 0; y < gainHeight; y ++ ) for ( let x = 0; x < gainWidth; x ++ ) gainPixels[ y * gainWidth + x ] = x < gainWidth / 2 ? gainLeft : gainRight;
	const gainJpeg = await sharp( gainPixels, { raw: { width: gainWidth, height: gainHeight, channels: 1 } } ).jpeg( { quality: 98 } ).toBuffer();

	const xmp = segment( 0xe1, Buffer.concat( [ Buffer.from( 'http://ns.adobe.com/xap/1.0/\0', 'latin1' ), Buffer.from( xmpPacket( metadata ), 'utf8' ) ] ) );
	const mpfLength = 4 + mpfPayload( { primarySize: 0, gainSize: 0, gainOffset: 0, littleEndian } ).length;

	const primarySize = 2 + xmp.length + mpfLength + ( sdrJpeg.length - 2 );
	const markerIndex = 2 + xmp.length;
	const gainStart = primarySize;
	const mpf = segment( 0xe2, mpfPayload( { primarySize, gainSize: gainJpeg.length, gainOffset: gainStart - ( markerIndex + 8 ), littleEndian } ) );

	const file = Buffer.concat( [ Buffer.from( [ 0xff, 0xd8 ] ), xmp, mpf, sdrJpeg.subarray( 2 ), gainJpeg ] );
	return file.buffer.slice( file.byteOffset, file.byteOffset + file.byteLength );

};

const srgbToLinear = ( value255 ) => {

	const v = value255 / 255;
	return v <= 0.04045 ? v / 12.92 : ( ( v + 0.055 ) / 1.055 ) ** 2.4;

};

export const expectedLinear = ( sdr8, gain8, meta = {} ) => {

	const m = { ...DEFAULT_METADATA, ...meta };
	const maxDisplayBoost = 1.8 ** ( m.hdrCapacityMax * 0.5 );
	const weight = Math.min( Math.max( ( Math.log2( maxDisplayBoost ) - m.hdrCapacityMin ) / ( m.hdrCapacityMax - m.hdrCapacityMin ), 0 ), 1 );
	const recovery = ( gain8 / 255 ) ** ( 1 / m.gamma );
	const logBoost = m.gainMapMin + ( m.gainMapMax - m.gainMapMin ) * recovery;
	const hdr = ( sdr8 + m.offsetSDR * 64 ) * 2 ** ( logBoost * weight ) - m.offsetHDR * 64;
	return Math.min( Math.max( srgbToLinear( hdr ), 0 ), 65504 );

};
