import { theme } from './theme.js';
import { font, roundRect, fillRoundRect, fitText, drawText, contains, clamp } from './draw.js';
import { createElementStub } from './dom.js';
import { getColorFormat, parseColorString, toRGB, rgbToHex, rgbToInt } from './color.js';
import { OptionPopup, ColorPopup } from './popups.js';

class Controller {

	constructor( parent, object, property, className ) {

		this.parent = parent;
		this.object = object;
		this.property = property;

		this._className = className;
		this._disabled = false;
		this._hidden = false;
		this._name = property;
		this._tooltip = '';
		this._listening = false;
		this._listenPrevValue = undefined;
		this._changed = false;
		this._onChange = undefined;
		this._onFinishChange = undefined;

		this._x = 0;
		this._y = 0;
		this._w = 0;
		this._nameW = 0;

		this.domElement = createElementStub();
		this.initialValue = this.getValue();

		parent.children.push( this );
		parent.controllers.push( this );
		parent._invalidate();

	}

	name( name ) {

		this._name = name;
		this._invalidate();
		return this;

	}

	title( title ) {

		this._tooltip = title;
		return this;

	}

	onChange( callback ) {

		this._onChange = callback;
		return this;

	}

	_callOnChange() {

		this.parent._callOnChange( this );

		if ( this._onChange !== undefined ) {

			this._onChange.call( this, this.getValue() );

		}

		this._changed = true;

	}

	onFinishChange( callback ) {

		this._onFinishChange = callback;
		return this;

	}

	_callOnFinishChange() {

		if ( this._changed ) {

			this.parent._callOnFinishChange( this );

			if ( this._onFinishChange !== undefined ) {

				this._onFinishChange.call( this, this.getValue() );

			}

		}

		this._changed = false;

	}

	reset() {

		this.setValue( this.initialValue );
		this._callOnFinishChange();
		return this;

	}

	enable( enabled = true ) {

		return this.disable( ! enabled );

	}

	disable( disabled = true ) {

		if ( disabled === this._disabled ) return this;

		this._disabled = disabled;
		this._invalidate();

		return this;

	}

	show( show = true ) {

		this._hidden = ! show;
		this._invalidate();

		return this;

	}

	hide() {

		return this.show( false );

	}

	options( options ) {

		const controller = this.parent.add( this.object, this.property, options );
		controller.name( this._name );
		this.destroy();

		return controller;

	}

	min() {

		return this;

	}

	max() {

		return this;

	}

	step() {

		return this;

	}

	decimals() {

		return this;

	}

	listen( listen = true ) {

		this._listening = listen;

		if ( listen ) {

			this._listenPrevValue = this._listenKey();
			this.parent.root._listeners.add( this );

		} else {

			this.parent.root._listeners.delete( this );

		}

		return this;

	}

	_listenKey() {

		return this.save();

	}

	_poll() {

		const current = this._listenKey();

		if ( current !== this._listenPrevValue ) this.updateDisplay();

		this._listenPrevValue = current;

	}

	getValue() {

		return this.object[ this.property ];

	}

	setValue( value ) {

		if ( this.getValue() !== value ) {

			this.object[ this.property ] = value;
			this._callOnChange();
			this.updateDisplay();

		}

		return this;

	}

	updateDisplay() {

		this._invalidate();
		return this;

	}

	load( value ) {

		this.setValue( value );
		this._callOnFinishChange();
		return this;

	}

	save() {

		return this.getValue();

	}

	destroy() {

		this.listen( false );
		this.parent._forget( this );

		const children = this.parent.children;
		const controllers = this.parent.controllers;

		children.splice( children.indexOf( this ), 1 );
		controllers.splice( controllers.indexOf( this ), 1 );

		this.parent._invalidate();

	}

	_invalidate() {

		this.parent._invalidate();

	}

	_height() {

		return this._hidden ? 0 : theme.widgetHeight;

	}

	_layout( ctx, x, y, w ) {

		this._x = x;
		this._y = y;
		this._w = w;

		const innerW = w - 2 * theme.padding;

		ctx.font = font();

		const wanted = ctx.measureText( this._name ).width + theme.spacing;

		this._nameW = Math.min( Math.max( innerW * theme.nameWidth, wanted ), innerW * 0.7 );

	}

	_row() {

		return { x: this._x, y: this._y, w: this._w, h: theme.widgetHeight };

	}

	_inner() {

		return { x: this._x + theme.padding, y: this._y, w: this._w - 2 * theme.padding, h: theme.widgetHeight };

	}

	_nameRect() {

		const inner = this._inner();

		return { x: inner.x, y: inner.y, w: this._nameW, h: inner.h };

	}

	_widgetRect() {

		const inner = this._inner();

		return { x: inner.x + this._nameW, y: inner.y, w: inner.w - this._nameW, h: inner.h };

	}

	_hitPart( x, y ) {

		if ( contains( this._row(), x, y ) === false ) return null;

		return this._partAt( x, y );

	}

	_partAt() {

		return 'widget';

	}

	_paint( ctx, view ) {

		if ( this._disabled ) ctx.globalAlpha = theme.disabledOpacity;

		this._draw( ctx, view );

		ctx.globalAlpha = 1;

	}

	_drawName( ctx ) {

		const rect = this._nameRect();

		ctx.font = font();
		drawText( ctx, fitText( ctx, this._name, rect.w - theme.spacing ), rect.x, rect.y + rect.h / 2 + 0.5, theme.textColor );

	}

	_draw( ctx ) {

		this._drawName( ctx );

	}

	_pointerDown() {}

	_pointerMove() {}

	_pointerUp() {}

	_wheel() {

		return false;

	}

	_keyDown() {

		return false;

	}

	_arrowKeyMultiplier( modifiers ) {

		let multiplier = this._stepExplicit ? 1 : 10;

		if ( modifiers.shift ) multiplier *= 10;
		else if ( modifiers.alt ) multiplier /= 10;

		return multiplier;

	}

}

class BooleanController extends Controller {

	constructor( parent, object, property ) {

		super( parent, object, property, 'boolean' );

	}

	_box() {

		const widget = this._widgetRect();
		const size = theme.checkboxSize;

		return { x: widget.x, y: widget.y + ( widget.h - size ) / 2, w: size, h: size };

	}

	_draw( ctx, view ) {

		this._drawName( ctx );

		const box = this._box();
		const checked = this.getValue() === true;

		fillRoundRect( ctx, box.x, box.y, box.w, box.h, view.isHover( this ) ? theme.hoverColor : theme.widgetColor );

		if ( checked ) {

			ctx.strokeStyle = theme.textColor;
			ctx.lineWidth = 1.5;
			ctx.lineCap = 'round';
			ctx.lineJoin = 'round';
			ctx.beginPath();
			ctx.moveTo( box.x + box.w * 0.25, box.y + box.h * 0.54 );
			ctx.lineTo( box.x + box.w * 0.43, box.y + box.h * 0.72 );
			ctx.lineTo( box.x + box.w * 0.76, box.y + box.h * 0.30 );
			ctx.stroke();

		}

	}

	_pointerDown() {

		this.setValue( ! this.getValue() );
		this._callOnFinishChange();

	}

}

class StringController extends Controller {

	constructor( parent, object, property ) {

		super( parent, object, property, 'string' );

	}

	_partAt( x, y ) {

		return contains( this._widgetRect(), x, y ) ? 'input' : 'name';

	}

	_draw( ctx, view ) {

		this._drawName( ctx );
		view.drawInput( ctx, this, 'input', this._widgetRect(), String( this.getValue() ), theme.stringColor, false );

	}

	_pointerDown( view, part, x ) {

		if ( part !== 'input' ) return;

		view.beginEdit( this, 'input', String( this.getValue() ), {
			onInput: ( text ) => this.setValue( text ),
			onCommit: () => this._callOnFinishChange()
		}, x );

	}

}

class FunctionController extends Controller {

	constructor( parent, object, property ) {

		super( parent, object, property, 'function' );

	}

	setValue() {

		return this;

	}

	_draw( ctx, view ) {

		const rect = this._inner();
		const pressed = view.isActive( this );
		const color = pressed ? theme.focusColor : view.isHover( this ) ? theme.hoverColor : theme.widgetColor;

		fillRoundRect( ctx, rect.x, rect.y, rect.w, rect.h, color );

		ctx.font = font();
		drawText( ctx, fitText( ctx, this._name, rect.w - 2 * theme.spacing ), rect.x + rect.w / 2, rect.y + rect.h / 2 + 0.5, theme.textColor, 'center' );

	}

	_pointerUp( view, part, x, y ) {

		if ( contains( this._row(), x, y ) === false ) return;

		this.getValue().call( this.object );
		this._callOnChange();

	}

}

class OptionController extends Controller {

	constructor( parent, object, property, options ) {

		super( parent, object, property, 'option' );

		if ( Array.isArray( options ) ) {

			this._names = options.map( String );
			this._values = options;

		} else {

			this._names = Object.keys( options );
			this._values = Object.values( options );

		}

	}

	_displayText() {

		const value = this.getValue();
		const index = this._values.indexOf( value );

		return index === - 1 ? String( value ) : this._names[ index ];

	}

	_draw( ctx, view ) {

		this._drawName( ctx );

		const rect = this._widgetRect();
		const open = view.popup !== null && view.popup.owner === this;
		const color = open ? theme.focusColor : view.isHover( this ) ? theme.hoverColor : theme.widgetColor;

		fillRoundRect( ctx, rect.x, rect.y, rect.w, rect.h, color );

		ctx.font = font();
		drawText( ctx, fitText( ctx, this._displayText(), rect.w - 22 ), rect.x + theme.inputPadding + 2, rect.y + rect.h / 2 + 0.5, theme.textColor );

		const cx = rect.x + rect.w - 10;
		const cy = rect.y + rect.h / 2;

		ctx.fillStyle = theme.textColor;
		ctx.beginPath();
		ctx.moveTo( cx - 3.5, cy - 1.5 );
		ctx.lineTo( cx + 3.5, cy - 1.5 );
		ctx.lineTo( cx, cy + 2.5 );
		ctx.closePath();
		ctx.fill();

	}

	_pointerDown( view ) {

		view.togglePopup( this, () => new OptionPopup( this ) );

	}

	_select( index ) {

		this.setValue( this._values[ index ] );
		this._callOnFinishChange();

	}

}

class NumberController extends Controller {

	constructor( parent, object, property, min, max, step ) {

		super( parent, object, property, 'number' );

		this._min = min;
		this._max = max;
		this._step = step;
		this._stepExplicit = step !== undefined;
		this._decimals = undefined;
		this._hasSlider = false;
		this._drag = null;

		if ( this._stepExplicit === false ) this._step = this._getImplicitStep();

		this._onUpdateMinMax();

	}

	get _hasMin() {

		return this._min !== undefined;

	}

	get _hasMax() {

		return this._max !== undefined;

	}

	min( min ) {

		this._min = min;
		this._onUpdateMinMax();
		return this;

	}

	max( max ) {

		this._max = max;
		this._onUpdateMinMax();
		return this;

	}

	step( step, explicit = true ) {

		this._step = step;
		this._stepExplicit = explicit;
		return this;

	}

	decimals( decimals ) {

		this._decimals = decimals;
		this.updateDisplay();
		return this;

	}

	_onUpdateMinMax() {

		if ( this._hasSlider === false && this._hasMin && this._hasMax ) {

			if ( this._stepExplicit === false ) this.step( this._getImplicitStep(), false );

			this._hasSlider = true;
			this.updateDisplay();

		}

	}

	_getImplicitStep() {

		if ( this._hasMin && this._hasMax ) return ( this._max - this._min ) / 1000;

		return 0.1;

	}

	_snap( value ) {

		const rounded = Math.round( value / this._step ) * this._step;

		return parseFloat( rounded.toPrecision( 15 ) );

	}

	_clamp( value ) {

		if ( value < this._min ) value = this._min;
		if ( value > this._max ) value = this._max;

		return value;

	}

	_snapClampSetValue( value ) {

		this.setValue( this._clamp( this._snap( value ) ) );

	}

	_displayText() {

		const value = this.getValue();

		return this._decimals === undefined ? String( value ) : Number( value ).toFixed( this._decimals );

	}

	_rects() {

		const widget = this._widgetRect();

		if ( this._hasSlider === false ) return { input: widget };

		const inputW = Math.max( theme.sliderInputMinWidth, widget.w * theme.sliderInputWidth );
		const sliderW = widget.w - inputW - theme.spacing;

		return {
			slider: { x: widget.x, y: widget.y, w: sliderW, h: widget.h },
			input: { x: widget.x + sliderW + theme.spacing, y: widget.y, w: inputW, h: widget.h }
		};

	}

	_partAt( x, y ) {

		const rects = this._rects();

		if ( rects.slider && contains( rects.slider, x, y ) ) return 'slider';
		if ( contains( rects.input, x, y ) ) return 'input';

		return 'name';

	}

	_draw( ctx, view ) {

		this._drawName( ctx );

		const rects = this._rects();

		if ( rects.slider ) {

			const slider = rects.slider;
			const active = view.isActive( this, 'slider' );
			const color = active ? theme.focusColor : view.isHover( this, 'slider' ) ? theme.hoverColor : theme.widgetColor;

			fillRoundRect( ctx, slider.x, slider.y, slider.w, slider.h, color );

			const value = this.getValue();
			const percent = clamp( ( value - this._min ) / ( this._max - this._min ), 0, 1 );

			ctx.save();
			roundRect( ctx, slider.x, slider.y, slider.w, slider.h );
			ctx.clip();
			ctx.fillStyle = theme.numberColor;
			ctx.fillRect( slider.x, slider.y, slider.w * ( Number.isFinite( percent ) ? percent : 0 ), slider.h );
			ctx.restore();

		}

		view.drawInput( ctx, this, 'input', rects.input, this._displayText(), theme.numberColor, false );

	}

	_setFromSlider( x ) {

		const slider = this._rects().slider;
		const t = clamp( ( x - slider.x ) / slider.w, 0, 1 );

		this._snapClampSetValue( this._min + t * ( this._max - this._min ) );

	}

	_pointerDown( view, part, x, y ) {

		if ( part === 'slider' ) {

			view.focus = this;
			this._setFromSlider( x );

		} else if ( part === 'input' ) {

			view.focus = this;
			this._drag = { startX: x, startY: y, lastY: y, moved: false };

		}

	}

	_pointerMove( view, part, x, y ) {

		if ( part === 'slider' ) {

			this._setFromSlider( x );

		} else if ( part === 'input' && this._drag !== null ) {

			const drag = this._drag;

			if ( drag.moved === false && Math.abs( y - drag.startY ) < 3 ) return;

			drag.moved = true;

			const delta = ( drag.lastY - y ) * this._step * this._arrowKeyMultiplier( view.modifiers );

			drag.lastY = y;
			this._snapClampSetValue( this.getValue() + delta );

		}

	}

	_pointerUp( view, part, x ) {

		if ( part === 'slider' ) {

			this._callOnFinishChange();

		} else if ( part === 'input' && this._drag !== null ) {

			const moved = this._drag.moved;

			this._drag = null;

			if ( moved ) {

				this._callOnFinishChange();
				return;

			}

			view.beginEdit( this, 'input', this._displayText(), {
				onInput: ( text ) => {

					let value = parseFloat( text );

					if ( isNaN( value ) ) return;
					if ( this._stepExplicit ) value = this._snap( value );

					this.setValue( this._clamp( value ) );

				},
				onStep: ( direction, modifiers ) => {

					this._snapClampSetValue( this.getValue() + direction * this._step * this._arrowKeyMultiplier( modifiers ) );

					return this._displayText();

				},
				onCommit: () => this._callOnFinishChange()
			}, x );

		}

	}

	_keyDown( view, event ) {

		let direction = 0;

		if ( event.key === 'up' || event.key === 'right' ) direction = 1;
		else if ( event.key === 'down' || event.key === 'left' ) direction = - 1;
		else return false;

		this._snapClampSetValue( this.getValue() + direction * this._step * this._arrowKeyMultiplier( view.modifiers ) );
		this._callOnFinishChange();

		return true;

	}

	_wheel( view, part, direction ) {

		if ( view.focus !== this || part === 'name' ) return false;

		this._snapClampSetValue( this.getValue() + direction * this._step * this._arrowKeyMultiplier( view.modifiers ) );
		this._callOnFinishChange();

		return true;

	}

}

class ColorController extends Controller {

	constructor( parent, object, property, rgbScale = 1 ) {

		super( parent, object, property, 'color' );

		this._rgbScale = rgbScale;
		this._format = getColorFormat( this.initialValue );

		if ( this._format === null ) {

			console.error( 'lil-gui: addColor failed. Unsupported color value for property', property, this.initialValue );

		}

	}

	_getRGB() {

		return toRGB( this.getValue(), this._format, this._rgbScale );

	}

	_setRGB( rgb ) {

		const current = this._getRGB();

		if ( current[ 0 ] === rgb[ 0 ] && current[ 1 ] === rgb[ 1 ] && current[ 2 ] === rgb[ 2 ] ) return;

		const value = this.getValue();
		const scale = this._rgbScale;

		switch ( this._format ) {

			case 'string':
				this.object[ this.property ] = rgbToHex( rgb );
				break;

			case 'int':
				this.object[ this.property ] = rgbToInt( rgb );
				break;

			case 'array':
				value[ 0 ] = rgb[ 0 ] / 255 * scale;
				value[ 1 ] = rgb[ 1 ] / 255 * scale;
				value[ 2 ] = rgb[ 2 ] / 255 * scale;
				break;

			case 'object':
				value.r = rgb[ 0 ] / 255 * scale;
				value.g = rgb[ 1 ] / 255 * scale;
				value.b = rgb[ 2 ] / 255 * scale;
				break;

		}

		this._callOnChange();
		this.updateDisplay();

	}

	setValue( value ) {

		const format = getColorFormat( value );

		if ( format === null ) return this;

		this._setRGB( toRGB( value, format, format === this._format ? this._rgbScale : 1 ) );

		return this;

	}

	save() {

		const value = this.getValue();

		if ( this._format === 'array' ) return value.slice( 0, 3 );
		if ( this._format === 'object' ) return { r: value.r, g: value.g, b: value.b };

		return value;

	}

	_listenKey() {

		return rgbToHex( this._getRGB() );

	}

	_rects() {

		const widget = this._widgetRect();
		const inputW = Math.max( theme.colorInputMinWidth, widget.w * theme.colorInputWidth );
		const swatchW = widget.w - inputW - theme.spacing;

		return {
			swatch: { x: widget.x, y: widget.y, w: swatchW, h: widget.h },
			input: { x: widget.x + swatchW + theme.spacing, y: widget.y, w: inputW, h: widget.h }
		};

	}

	_partAt( x, y ) {

		const rects = this._rects();

		if ( contains( rects.swatch, x, y ) ) return 'swatch';
		if ( contains( rects.input, x, y ) ) return 'input';

		return 'name';

	}

	_draw( ctx, view ) {

		this._drawName( ctx );

		const rects = this._rects();
		const swatch = rects.swatch;
		const rgb = this._getRGB();
		const open = view.popup !== null && view.popup.owner === this;

		fillRoundRect( ctx, swatch.x, swatch.y, swatch.w, swatch.h, `rgb( ${ rgb[ 0 ] }, ${ rgb[ 1 ] }, ${ rgb[ 2 ] } )` );

		if ( open || view.isHover( this, 'swatch' ) ) {

			ctx.strokeStyle = open ? theme.focusColor : theme.hoverColor;
			ctx.lineWidth = 1;
			roundRect( ctx, swatch.x + 0.5, swatch.y + 0.5, swatch.w - 1, swatch.h - 1 );
			ctx.stroke();

		}

		view.drawInput( ctx, this, 'input', rects.input, rgbToHex( rgb ), theme.textColor, true );

	}

	_pointerDown( view, part, x ) {

		if ( part === 'swatch' ) {

			view.togglePopup( this, () => new ColorPopup( this ) );

		} else if ( part === 'input' ) {

			view.beginEdit( this, 'input', rgbToHex( this._getRGB() ), {
				onInput: ( text ) => {

					const rgb = parseColorString( text );

					if ( rgb !== null ) this._setRGB( rgb );

				},
				onCommit: () => this._callOnFinishChange()
			}, x );

		}

	}

}

export { Controller, BooleanController, ColorController, FunctionController, NumberController, OptionController, StringController };
