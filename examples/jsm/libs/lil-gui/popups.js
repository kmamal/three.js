import { theme } from './theme.js';
import { font, roundRect, fillRoundRect, drawText, contains, clamp } from './draw.js';
import { hsvToRgb, rgbToHsv } from './color.js';

const ITEM_HEIGHT = theme.widgetHeight;

class OptionPopup {

	constructor( owner ) {

		this.owner = owner;
		this.scroll = 0;
		this.hoverIndex = - 1;

	}

	rect( view ) {

		const widget = this.owner._widgetRect();
		const total = this.owner._names.length * ITEM_HEIGHT;
		const y = widget.y + widget.h + 2;
		const available = Math.max( ITEM_HEIGHT * 3, view.bottom - y - theme.spacing );
		const h = Math.min( total, available );

		this.maxScroll = total - h;
		this.scroll = clamp( this.scroll, 0, this.maxScroll );

		return { x: widget.x, y, w: widget.w, h };

	}

	extent() {

		const widget = this.owner._widgetRect();

		return widget.y + widget.h + 2 + this.owner._names.length * ITEM_HEIGHT + theme.spacing;

	}

	draw( ctx, view ) {

		const rect = this.rect( view );

		fillRoundRect( ctx, rect.x, rect.y, rect.w, rect.h, '#2b2b2b' );

		ctx.save();
		roundRect( ctx, rect.x, rect.y, rect.w, rect.h );
		ctx.clip();
		ctx.font = font();

		const selected = this.owner._values.indexOf( this.owner.getValue() );

		for ( let i = 0; i < this.owner._names.length; i ++ ) {

			const y = rect.y + i * ITEM_HEIGHT - this.scroll;

			if ( y + ITEM_HEIGHT < rect.y || y > rect.y + rect.h ) continue;

			if ( i === this.hoverIndex ) {

				ctx.fillStyle = theme.hoverColor;
				ctx.fillRect( rect.x, y, rect.w, ITEM_HEIGHT );

			} else if ( i === selected ) {

				ctx.fillStyle = theme.widgetColor;
				ctx.fillRect( rect.x, y, rect.w, ITEM_HEIGHT );

			}

			drawText( ctx, this.owner._names[ i ], rect.x + 6, y + ITEM_HEIGHT / 2 + 0.5, theme.textColor );

		}

		ctx.restore();

		ctx.strokeStyle = theme.focusColor;
		ctx.lineWidth = 1;
		roundRect( ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1 );
		ctx.stroke();

	}

	indexAt( view, x, y ) {

		const rect = this.rect( view );

		if ( contains( rect, x, y ) === false ) return - 1;

		return Math.floor( ( y - rect.y + this.scroll ) / ITEM_HEIGHT );

	}

	pointerDown( view, x, y ) {

		const index = this.indexAt( view, x, y );

		if ( index >= 0 && index < this.owner._names.length ) this.owner._select( index );

		view.closePopup();

	}

	pointerMove( view, x, y ) {

		const index = this.indexAt( view, x, y );

		if ( index !== this.hoverIndex ) {

			this.hoverIndex = index;
			view.invalidate();

		}

	}

	pointerUp() {}

	wheel( view, direction ) {

		this.rect( view );
		this.scroll = clamp( this.scroll - direction * ITEM_HEIGHT * 2, 0, this.maxScroll );
		view.invalidate();

	}

	close() {}

}

class ColorPopup {

	constructor( owner ) {

		this.owner = owner;
		this.hsv = rgbToHsv( owner._getRGB() );
		this.drag = null;

	}

	rect() {

		const widget = this.owner._widgetRect();
		const inner = this.owner._inner();

		return { x: inner.x, y: widget.y + widget.h + 2, w: inner.w, h: theme.pickerHeight + 8 };

	}

	extent() {

		const rect = this.rect();

		return rect.y + rect.h + theme.spacing;

	}

	areas() {

		const rect = this.rect();
		const hueW = theme.pickerHueWidth;
		const svW = rect.w - 8 - hueW - 4;

		return {
			rect,
			sv: { x: rect.x + 4, y: rect.y + 4, w: svW, h: theme.pickerHeight },
			hue: { x: rect.x + 4 + svW + 4, y: rect.y + 4, w: hueW, h: theme.pickerHeight }
		};

	}

	draw( ctx ) {

		const { rect, sv, hue } = this.areas();
		const [ h, s, v ] = this.hsv;

		fillRoundRect( ctx, rect.x, rect.y, rect.w, rect.h, '#2b2b2b' );

		const base = hsvToRgb( [ h, 1, 1 ] );

		ctx.fillStyle = `rgb( ${ base[ 0 ] }, ${ base[ 1 ] }, ${ base[ 2 ] } )`;
		ctx.fillRect( sv.x, sv.y, sv.w, sv.h );

		let gradient = ctx.createLinearGradient( sv.x, 0, sv.x + sv.w, 0 );
		gradient.addColorStop( 0, 'rgba( 255, 255, 255, 1 )' );
		gradient.addColorStop( 1, 'rgba( 255, 255, 255, 0 )' );
		ctx.fillStyle = gradient;
		ctx.fillRect( sv.x, sv.y, sv.w, sv.h );

		gradient = ctx.createLinearGradient( 0, sv.y, 0, sv.y + sv.h );
		gradient.addColorStop( 0, 'rgba( 0, 0, 0, 0 )' );
		gradient.addColorStop( 1, 'rgba( 0, 0, 0, 1 )' );
		ctx.fillStyle = gradient;
		ctx.fillRect( sv.x, sv.y, sv.w, sv.h );

		gradient = ctx.createLinearGradient( 0, hue.y, 0, hue.y + hue.h );

		for ( let i = 0; i <= 6; i ++ ) {

			const c = hsvToRgb( [ i * 60 % 360, 1, 1 ] );
			gradient.addColorStop( i / 6, `rgb( ${ c[ 0 ] }, ${ c[ 1 ] }, ${ c[ 2 ] } )` );

		}

		ctx.fillStyle = gradient;
		ctx.fillRect( hue.x, hue.y, hue.w, hue.h );

		const cx = sv.x + s * sv.w;
		const cy = sv.y + ( 1 - v ) * sv.h;

		ctx.lineWidth = 1;
		ctx.strokeStyle = '#000000';
		ctx.beginPath();
		ctx.arc( cx, cy, 4.5, 0, Math.PI * 2 );
		ctx.stroke();
		ctx.strokeStyle = '#ffffff';
		ctx.beginPath();
		ctx.arc( cx, cy, 3.5, 0, Math.PI * 2 );
		ctx.stroke();

		const hy = hue.y + h / 360 * hue.h;

		ctx.strokeStyle = '#000000';
		ctx.strokeRect( hue.x - 0.5, hy - 2.5, hue.w + 1, 5 );
		ctx.strokeStyle = '#ffffff';
		ctx.strokeRect( hue.x + 0.5, hy - 1.5, hue.w - 1, 3 );

	}

	update( x, y ) {

		const { sv, hue } = this.areas();

		if ( this.drag === 'sv' ) {

			this.hsv[ 1 ] = clamp( ( x - sv.x ) / sv.w, 0, 1 );
			this.hsv[ 2 ] = 1 - clamp( ( y - sv.y ) / sv.h, 0, 1 );

		} else if ( this.drag === 'hue' ) {

			this.hsv[ 0 ] = clamp( ( y - hue.y ) / hue.h, 0, 1 ) * 359.999;

		}

		this.owner._setRGB( hsvToRgb( this.hsv ) );

	}

	pointerDown( view, x, y ) {

		const { rect, sv, hue } = this.areas();

		if ( contains( sv, x, y ) ) {

			this.drag = 'sv';
			this.update( x, y );

		} else if ( contains( hue, x, y ) ) {

			this.drag = 'hue';
			this.update( x, y );

		} else if ( contains( rect, x, y ) === false ) {

			view.closePopup();

		}

	}

	pointerMove( view, x, y ) {

		if ( this.drag !== null ) this.update( x, y );

	}

	pointerUp() {

		this.drag = null;

	}

	wheel() {}

	close() {

		this.owner._callOnFinishChange();

	}

}

export { OptionPopup, ColorPopup };
