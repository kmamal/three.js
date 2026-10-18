import { clamp } from './draw.js';

function getColorFormat( value ) {

	if ( typeof value === 'string' ) return 'string';
	if ( typeof value === 'number' ) return 'int';
	if ( Array.isArray( value ) ) return 'array';
	if ( value !== null && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value ) return 'object';

	return null;

}

function parseColorString( string ) {

	const text = string.trim().toLowerCase();

	let match = /^#?([0-9a-f]{3})$/.exec( text );
	if ( match ) {

		const [ r, g, b ] = match[ 1 ].split( '' ).map( ( c ) => parseInt( c + c, 16 ) );
		return [ r, g, b ];

	}

	match = /^#?([0-9a-f]{6})$/.exec( text );
	if ( match ) {

		const int = parseInt( match[ 1 ], 16 );
		return [ ( int >> 16 ) & 255, ( int >> 8 ) & 255, int & 255 ];

	}

	match = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*[\d.]+\s*)?\)$/.exec( text );
	if ( match ) {

		return [ 1, 2, 3 ].map( ( i ) => clamp( Math.round( parseFloat( match[ i ] ) ), 0, 255 ) );

	}

	return null;

}

function toRGB( value, format, scale ) {

	switch ( format ) {

		case 'string':
			return parseColorString( value ) || [ 0, 0, 0 ];

		case 'int':
			return [ ( value >> 16 ) & 255, ( value >> 8 ) & 255, value & 255 ];

		case 'array':
			return [ 0, 1, 2 ].map( ( i ) => clamp( Math.round( value[ i ] / scale * 255 ), 0, 255 ) );

		case 'object':
			return [ value.r, value.g, value.b ].map( ( c ) => clamp( Math.round( c / scale * 255 ), 0, 255 ) );

	}

	return [ 0, 0, 0 ];

}

function rgbToHex( rgb ) {

	return '#' + rgb.map( ( c ) => c.toString( 16 ).padStart( 2, '0' ) ).join( '' );

}

function rgbToInt( rgb ) {

	return ( rgb[ 0 ] << 16 ) | ( rgb[ 1 ] << 8 ) | rgb[ 2 ];

}

function rgbToHsv( [ r, g, b ] ) {

	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max( r, g, b );
	const min = Math.min( r, g, b );
	const d = max - min;

	let h = 0;

	if ( d !== 0 ) {

		if ( max === r ) h = ( ( g - b ) / d ) % 6;
		else if ( max === g ) h = ( b - r ) / d + 2;
		else h = ( r - g ) / d + 4;

		h *= 60;
		if ( h < 0 ) h += 360;

	}

	return [ h, max === 0 ? 0 : d / max, max ];

}

function hsvToRgb( [ h, s, v ] ) {

	const c = v * s;
	const x = c * ( 1 - Math.abs( ( h / 60 ) % 2 - 1 ) );
	const m = v - c;

	let rgb;

	if ( h < 60 ) rgb = [ c, x, 0 ];
	else if ( h < 120 ) rgb = [ x, c, 0 ];
	else if ( h < 180 ) rgb = [ 0, c, x ];
	else if ( h < 240 ) rgb = [ 0, x, c ];
	else if ( h < 300 ) rgb = [ x, 0, c ];
	else rgb = [ c, 0, x ];

	return rgb.map( ( channel ) => clamp( Math.round( ( channel + m ) * 255 ), 0, 255 ) );

}

export { getColorFormat, parseColorString, toRGB, rgbToHex, rgbToInt, rgbToHsv, hsvToRgb };
