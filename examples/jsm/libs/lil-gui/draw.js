import { theme } from './theme.js';

function font( bold = false, mono = false ) {

	return `${ bold ? 'bold ' : '' }${ theme.fontSize }px ${ mono ? theme.fontFamilyMono : theme.fontFamily }`;

}

function roundRect( ctx, x, y, w, h, r = theme.widgetBorderRadius ) {

	r = Math.min( r, w / 2, h / 2 );

	ctx.beginPath();
	ctx.moveTo( x + r, y );
	ctx.lineTo( x + w - r, y );
	ctx.arcTo( x + w, y, x + w, y + r, r );
	ctx.lineTo( x + w, y + h - r );
	ctx.arcTo( x + w, y + h, x + w - r, y + h, r );
	ctx.lineTo( x + r, y + h );
	ctx.arcTo( x, y + h, x, y + h - r, r );
	ctx.lineTo( x, y + r );
	ctx.arcTo( x, y, x + r, y, r );
	ctx.closePath();

}

function fillRoundRect( ctx, x, y, w, h, color, r ) {

	roundRect( ctx, x, y, w, h, r );
	ctx.fillStyle = color;
	ctx.fill();

}

function fitText( ctx, text, maxWidth ) {

	if ( maxWidth <= 0 ) return '';
	if ( ctx.measureText( text ).width <= maxWidth ) return text;

	let low = 0;
	let high = text.length;

	while ( low < high ) {

		const mid = ( low + high + 1 ) >> 1;

		if ( ctx.measureText( text.slice( 0, mid ) + '…' ).width <= maxWidth ) {

			low = mid;

		} else {

			high = mid - 1;

		}

	}

	return text.slice( 0, low ) + '…';

}

function drawText( ctx, text, x, y, color, align = 'left' ) {

	ctx.fillStyle = color;
	ctx.textAlign = align;
	ctx.textBaseline = 'middle';
	ctx.fillText( text, x, y );

}

function contains( rect, x, y ) {

	return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;

}

function clamp( value, min, max ) {

	return Math.max( min, Math.min( max, value ) );

}

export { font, roundRect, fillRoundRect, fitText, drawText, contains, clamp };
