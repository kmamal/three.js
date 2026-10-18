import { theme } from './theme.js';
import { font, roundRect, fillRoundRect, drawText, clamp } from './draw.js';
import { TextField } from './TextField.js';

const LEFT_BUTTON = 1;

class Panel {

	constructor( gui, backend, options ) {

		this.gui = gui;
		this.backend = backend;
		this.options = options;

		this.window = null;
		this.canvas = null;
		this.ctx = null;

		this.scroll = 0;
		this.maxScroll = 0;
		this.hover = null;
		this.focus = null;
		this.captured = null;
		this.editing = null;
		this.popup = null;
		this.popupCapture = null;
		this.pendingCaretX = null;
		this.modifiers = { shift: false, ctrl: false, alt: false };

		this.destroyed = false;
		this._timer = null;
		this._poll = null;
		this._lastDraw = 0;
		this._fitted = null;
		this._height = 0;

		this._create();

	}

	static create( gui, backend, options ) {

		try {

			return new Panel( gui, backend, options );

		} catch ( error ) {

			console.warn( `lil-gui: could not open a window (${ error.message }). Controls will work without a display.` );
			return null;

		}

	}

	get bottom() {

		return this.scroll + this._height;

	}

	_maxHeight() {

		return Math.floor( this.backend.getDisplayBounds().height * theme.maxWindowHeightRatio );

	}

	_create() {

		const { title, width, x, y, hidden, onClose } = this.options;
		const bounds = this.backend.getDisplayBounds();
		const height = clamp( Math.ceil( this.gui._height() ), theme.minWindowHeight, this._maxHeight() );

		const posX = x ?? bounds.x + bounds.width - width - 10;
		const posY = y ?? bounds.y + 40;

		const window = this.backend.createWindow( {
			title,
			width,
			height,
			x: Math.round( posX ),
			y: Math.round( posY ),
			resizable: true,
			accelerated: false,
			visible: ! hidden
		} );

		this.window = window;
		this._fitted = height;
		this._height = height;

		window.on( 'expose', () => this.invalidate() );
		window.on( 'resize', () => this.invalidate() );
		window.on( 'leave', () => this._setHover( null ) );
		window.on( 'blur', () => this._onBlur() );
		window.on( 'mouseButtonDown', ( e ) => this._onMouseButtonDown( e ) );
		window.on( 'mouseButtonUp', ( e ) => this._onMouseButtonUp( e ) );
		window.on( 'mouseMove', ( e ) => this._onMouseMove( e ) );
		window.on( 'mouseWheel', ( e ) => this._onMouseWheel( e ) );
		window.on( 'keyDown', ( e ) => this._onKeyDown( e ) );
		window.on( 'keyUp', ( e ) => this._onKeyUp( e ) );
		window.on( 'textInput', ( e ) => this._onTextInput( e ) );
		window.on( 'close', () => {

			const wasDestroyed = this.destroyed;

			this._teardown();
			if ( wasDestroyed === false && onClose ) onClose();

		} );

		this._poll = setInterval( () => this._pollListeners(), 33 );
		this._poll.unref();

		this.backend.floatWindow( title, () => {

			if ( this.destroyed ) return;

			window.setSize( window.width, this._fitted );
			window.setPosition( Math.round( posX ), Math.round( posY ) );
			this.invalidate();

		} );

		this.invalidate();

	}

	setTitle( title ) {

		if ( this.destroyed ) return;
		this.window.setTitle( title );

	}

	setVisible( visible ) {

		if ( this.destroyed ) return;

		if ( visible ) this.window.show();
		else this.window.hide();

	}

	destroy() {

		if ( this.destroyed ) return;

		const window = this.window;

		this._teardown();
		window.destroy();

	}

	_teardown() {

		this.destroyed = true;
		clearTimeout( this._timer );
		clearInterval( this._poll );
		this._timer = null;
		this._poll = null;

	}

	invalidate() {

		if ( this.destroyed || this._timer !== null ) return;

		const wait = Math.max( 0, 16 - ( performance.now() - this._lastDraw ) );

		this._timer = setTimeout( () => this._draw(), wait );

	}

	forget( controller ) {

		if ( this.editing !== null && this.editing.controller === controller ) this.editing = null;
		if ( this.popup !== null && this.popup.owner === controller ) this.popup = null;
		if ( this.popupCapture !== null && this.popupCapture.owner === controller ) this.popupCapture = null;
		if ( this.focus === controller ) this.focus = null;
		if ( this.hover !== null && this.hover.node === controller ) this.hover = null;
		if ( this.captured !== null && this.captured.node === controller ) this.captured = null;

	}

	_pollListeners() {

		const listeners = this.gui._listeners;

		if ( listeners.size === 0 ) return;

		for ( const controller of listeners ) controller._poll();

	}

	isHover( node, part ) {

		return this.hover !== null && this.hover.node === node && ( part === undefined || this.hover.part === part );

	}

	isActive( node, part ) {

		return this.captured !== null && this.captured.node === node && ( part === undefined || this.captured.part === part );

	}

	_setHover( target ) {

		const current = this.hover;

		if ( current === null && target === null ) return;
		if ( current !== null && target !== null && current.node === target.node && current.part === target.part ) return;

		this.hover = target;
		this.invalidate();

	}

	_hitTest( x, y ) {

		if ( y < theme.titleHeight ) return { node: this.gui, part: 'title' };

		const hit = this.gui._hit( x, y + this.scroll );

		if ( hit !== null && hit.node._disabled === true ) return null;

		return hit;

	}

	_contentHeight() {

		let height = this.gui._height();

		if ( this.popup !== null ) height = Math.max( height, this.popup.extent( this ) );

		return Math.ceil( height );

	}

	_draw() {

		this._timer = null;

		if ( this.destroyed ) return;

		this._lastDraw = performance.now();

		const win = this.window;
		const width = win.width;
		const height = win.height;
		const pw = win.pixelWidth;
		const ph = win.pixelHeight;

		this._height = height;

		if ( this.canvas === null || this.canvas.width !== pw || this.canvas.height !== ph ) {

			this.canvas = this.backend.createCanvas( pw, ph );
			this.ctx = this.canvas.getContext( '2d' );

		}

		const ctx = this.ctx;
		const gui = this.gui;

		ctx.setTransform( pw / width, 0, 0, ph / height, 0, 0 );
		ctx.fillStyle = theme.backgroundColor;
		ctx.fillRect( 0, 0, width, height );

		gui._layout( ctx, 0, 0, width );

		let contentHeight = this._contentHeight();
		const scrollable = contentHeight > height;

		if ( scrollable ) {

			gui._layout( ctx, 0, 0, width - theme.scrollbarWidth - 2 );
			contentHeight = this._contentHeight();

		}

		this._fit( contentHeight );

		this.maxScroll = Math.max( 0, contentHeight - height );
		this.scroll = clamp( this.scroll, 0, this.maxScroll );

		ctx.save();
		ctx.beginPath();
		ctx.rect( 0, theme.titleHeight, width, Math.max( 0, height - theme.titleHeight ) );
		ctx.clip();
		ctx.translate( 0, - this.scroll );

		gui._draw( ctx, this );

		if ( this.popup !== null ) this.popup.draw( ctx, this );

		ctx.restore();

		gui._drawTitle( ctx, this, 0 );

		if ( this.maxScroll > 0 ) this._drawScrollbar( ctx, width, height, contentHeight );

		win.render( pw, ph, pw * 4, 'rgba32', this.canvas.data() );

	}

	_drawScrollbar( ctx, width, height, contentHeight ) {

		const trackY = theme.titleHeight;
		const trackH = height - trackY;
		const thumbH = Math.max( 20, trackH * ( height - trackY ) / ( contentHeight - trackY ) );
		const thumbY = trackY + ( trackH - thumbH ) * ( this.scroll / this.maxScroll );

		fillRoundRect( ctx, width - theme.scrollbarWidth - 1, thumbY, theme.scrollbarWidth, thumbH, theme.widgetColor, theme.scrollbarWidth / 2 );

	}

	_fit( contentHeight ) {

		const win = this.window;
		const desired = clamp( contentHeight, theme.minWindowHeight, this._maxHeight() );

		if ( desired === this._fitted ) return;

		this._fitted = desired;

		if ( win.height !== desired ) win.setSize( win.width, desired );

	}

	drawInput( ctx, controller, part, rect, text, color, mono ) {

		const editing = this.editing !== null && this.editing.controller === controller && this.editing.part === part;
		const background = editing ? theme.focusColor : this.isHover( controller, part ) ? theme.hoverColor : theme.widgetColor;

		fillRoundRect( ctx, rect.x, rect.y, rect.w, rect.h, background );

		ctx.font = font( false, mono );

		const pad = theme.inputPadding;
		const innerX = rect.x + pad;
		const innerW = rect.w - pad * 2;
		const centerY = rect.y + rect.h / 2 + 0.5;

		ctx.save();
		ctx.beginPath();
		ctx.rect( innerX, rect.y, innerW, rect.h );
		ctx.clip();

		if ( editing === false ) {

			drawText( ctx, text, innerX, centerY, color );
			ctx.restore();
			return;

		}

		const field = this.editing.field;

		this.editing.metrics = { innerX, font: ctx.font };

		if ( this.pendingCaretX !== null ) {

			field.setCaret( this._indexAt( ctx, field, innerX, this.pendingCaretX ) );
			this.pendingCaretX = null;

		}

		const caretX = ctx.measureText( field.text.slice( 0, field.caret ) ).width;

		if ( caretX - field.scroll > innerW - 1 ) field.scroll = caretX - innerW + 1;
		if ( caretX - field.scroll < 0 ) field.scroll = caretX;
		field.scroll = Math.max( 0, field.scroll );

		const originX = innerX - field.scroll;

		if ( field.hasSelection ) {

			const a = ctx.measureText( field.text.slice( 0, field.start ) ).width;
			const b = ctx.measureText( field.text.slice( 0, field.end ) ).width;

			ctx.fillStyle = theme.selectionColor;
			ctx.fillRect( originX + a, rect.y + 3, b - a, rect.h - 6 );

		}

		drawText( ctx, field.text, originX, centerY, color );

		ctx.fillStyle = theme.textColor;
		ctx.fillRect( originX + caretX, rect.y + 3, 1, rect.h - 6 );
		ctx.restore();

	}

	_indexAt( ctx, field, innerX, x ) {

		const target = x - innerX + field.scroll;

		let best = 0;
		let bestDistance = Infinity;

		for ( let i = 0; i <= field.text.length; i ++ ) {

			const distance = Math.abs( ctx.measureText( field.text.slice( 0, i ) ).width - target );

			if ( distance < bestDistance ) {

				bestDistance = distance;
				best = i;

			}

		}

		return best;

	}

	beginEdit( controller, part, text, hooks, x ) {

		this.endEdit();

		this.editing = { controller, part, field: new TextField( text ), hooks, metrics: null };
		this.pendingCaretX = x ?? null;
		this.focus = controller;
		this.invalidate();

	}

	endEdit() {

		const editing = this.editing;

		if ( editing === null ) return;

		this.editing = null;
		this.pendingCaretX = null;

		if ( editing.hooks.onCommit ) editing.hooks.onCommit();

		this.invalidate();

	}

	togglePopup( owner, create ) {

		const open = this.popup !== null && this.popup.owner === owner;

		this.closePopup();

		if ( open ) return;

		this.popup = create();
		this.invalidate();

	}

	closePopup() {

		if ( this.popup === null ) return;

		const popup = this.popup;

		this.popup = null;
		this.popupCapture = null;
		popup.close();
		this.invalidate();

	}

	_onBlur() {

		this.endEdit();
		this.closePopup();
		this.captured = null;
		this._setHover( null );

	}

	_updateModifiers( event, down ) {

		this.modifiers.shift = event.shift === true;
		this.modifiers.ctrl = event.ctrl === true;
		this.modifiers.alt = event.alt === true;

		if ( event.key === 'shift' ) this.modifiers.shift = down;
		if ( event.key === 'ctrl' ) this.modifiers.ctrl = down;
		if ( event.key === 'alt' ) this.modifiers.alt = down;

	}

	_onMouseButtonDown( e ) {

		if ( e.button !== LEFT_BUTTON ) return;

		const x = e.x;
		const y = e.y + this.scroll;

		if ( this.popup !== null ) {

			const popup = this.popup;

			popup.pointerDown( this, x, y );

			if ( this.popup === popup ) this.popupCapture = popup;

			this.invalidate();
			return;

		}

		const target = this._hitTest( e.x, e.y );

		if ( this.editing !== null ) {

			const same = target !== null && target.node === this.editing.controller && target.part === this.editing.part;

			if ( same && this.editing.metrics !== null ) {

				const field = this.editing.field;

				this.ctx.font = this.editing.metrics.font;
				field.setCaret( this._indexAt( this.ctx, field, this.editing.metrics.innerX, x ), this.modifiers.shift );
				this.invalidate();
				return;

			}

			this.endEdit();

		}

		if ( target === null ) {

			this.focus = null;
			this.invalidate();
			return;

		}

		this.captured = target;
		target.node._pointerDown( this, target.part, x, y, e );
		this.invalidate();

	}

	_onMouseButtonUp( e ) {

		if ( e.button !== LEFT_BUTTON ) return;

		const x = e.x;
		const y = e.y + this.scroll;

		if ( this.popupCapture !== null ) {

			this.popupCapture.pointerUp( this, x, y );
			this.popupCapture = null;
			this.invalidate();
			return;

		}

		const captured = this.captured;

		this.captured = null;

		if ( captured !== null ) captured.node._pointerUp( this, captured.part, x, y, e );

		this.invalidate();

	}

	_onMouseMove( e ) {

		const x = e.x;
		const y = e.y + this.scroll;

		if ( this.popupCapture !== null ) {

			this.popupCapture.pointerMove( this, x, y );
			this.invalidate();
			return;

		}

		if ( this.captured !== null ) {

			this.captured.node._pointerMove( this, this.captured.part, x, y, e );
			this.invalidate();
			return;

		}

		if ( this.popup !== null ) {

			this.popup.pointerMove( this, x, y );
			this._setHover( null );
			return;

		}

		this._setHover( this._hitTest( e.x, e.y ) );

	}

	_onMouseWheel( e ) {

		const delta = e.flipped ? - e.dy : e.dy;

		if ( delta === 0 ) return;

		const direction = delta > 0 ? 1 : - 1;

		if ( this.popup !== null ) {

			this.popup.wheel( this, direction );
			return;

		}

		const target = this._hitTest( e.x, e.y );

		if ( target !== null && target.node._wheel( this, target.part, direction ) ) {

			this.invalidate();
			return;

		}

		this.scroll = clamp( this.scroll - direction * 36, 0, this.maxScroll );
		this.invalidate();

	}

	_onKeyDown( e ) {

		this._updateModifiers( e, true );

		if ( this.editing !== null ) {

			this._editKey( e );
			return;

		}

		if ( e.key === 'escape' && this.popup !== null ) {

			this.closePopup();
			return;

		}

		if ( this.focus !== null && this.focus._keyDown( this, e ) ) {

			this.invalidate();
			return;

		}

		const page = this._height - theme.titleHeight;

		if ( e.key === 'pageDown' ) this.scroll = clamp( this.scroll + page, 0, this.maxScroll );
		else if ( e.key === 'pageUp' ) this.scroll = clamp( this.scroll - page, 0, this.maxScroll );
		else if ( e.key === 'home' ) this.scroll = 0;
		else if ( e.key === 'end' ) this.scroll = this.maxScroll;
		else return;

		this.invalidate();

	}

	_onKeyUp( e ) {

		this._updateModifiers( e, false );

	}

	_editKey( e ) {

		const { field, hooks } = this.editing;
		const clipboard = this.backend.clipboard;

		let changed = false;

		if ( e.ctrl && ( e.key === 'c' || e.key === 'x' ) ) {

			if ( field.hasSelection && clipboard ) clipboard.setText( field.selectedText );

			if ( e.key === 'x' ) changed = field.deleteSelection();

		} else if ( e.ctrl && e.key === 'v' ) {

			if ( clipboard && clipboard.text ) {

				field.insert( clipboard.text.replace( /[\r\n]+/g, ' ' ) );
				changed = true;

			}

		} else {

			const result = field.key( e );

			if ( result === 'commit' ) {

				this.endEdit();
				return;

			}

			if ( ( result === 'up' || result === 'down' ) && hooks.onStep ) {

				field.text = hooks.onStep( result === 'up' ? 1 : - 1, this.modifiers );
				field.setCaret( field.text.length );

			}

			changed = result === 'changed';

		}

		if ( changed ) hooks.onInput( field.text );

		this.invalidate();

	}

	_onTextInput( e ) {

		if ( this.editing === null ) return;

		const { field, hooks } = this.editing;

		field.insert( e.text );
		hooks.onInput( field.text );
		this.invalidate();

	}

}

export { Panel };
