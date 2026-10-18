import { theme } from './theme.js';
import { font, fitText, drawText, contains } from './draw.js';
import { createElementStub } from './dom.js';
import { getDefaultBackend } from './backend.js';
import { Panel } from './Panel.js';
import { Controller, BooleanController, ColorController, FunctionController, NumberController, OptionController, StringController } from './Controller.js';

const roots = new Set();

class GUI {

	constructor( { parent, autoPlace = parent === undefined, container, width, title = 'Controls', closeFolders = false, injectStyles = true, touchStyles = true, x, y } = {} ) {

		this.parent = parent;
		this.root = parent ? parent.root : this;
		this.children = [];
		this.controllers = [];
		this.folders = [];

		this._closed = false;
		this._hidden = false;
		this._title = title;
		this._closeFolders = closeFolders;
		this._onChange = undefined;
		this._onFinishChange = undefined;
		this._onOpenClose = undefined;

		this._x = 0;
		this._y = 0;
		this._w = 0;
		this._childrenEnd = 0;

		this.domElement = createElementStub( ( visible ) => this.show( visible ) );
		this.$children = createElementStub();

		if ( parent ) {

			parent.children.push( this );
			parent.folders.push( this );
			parent._invalidate();

		} else {

			this._listeners = new Set();
			this._panel = null;

			if ( autoPlace ) {

				const backend = GUI.backend ?? getDefaultBackend();

				this._panel = Panel.create( this, backend, {
					title,
					width: width ?? theme.width,
					x,
					y,
					hidden: false,
					onClose: () => {

						this._panel = null;
						roots.delete( this );

					}
				} );

				if ( this._panel !== null ) roots.add( this );

			}

		}

	}

	static destroyAll() {

		for ( const root of Array.from( roots ) ) root.destroy();

	}

	add( object, property, $1, max, step ) {

		if ( Object( $1 ) === $1 ) {

			return new OptionController( this, object, property, $1 );

		}

		const initialValue = object[ property ];

		switch ( typeof initialValue ) {

			case 'number':
				return new NumberController( this, object, property, $1, max, step );

			case 'boolean':
				return new BooleanController( this, object, property );

			case 'string':
				return new StringController( this, object, property );

			case 'function':
				return new FunctionController( this, object, property );

		}

		console.error( `gui.add failed\n\tproperty:`, property, `\n\tobject:`, object, `\n\tvalue:`, initialValue );

	}

	addColor( object, property, rgbScale = 1 ) {

		return new ColorController( this, object, property, rgbScale );

	}

	addFolder( title ) {

		const folder = new GUI( { parent: this, title } );

		if ( this.root._closeFolders ) folder.close();

		return folder;

	}

	load( obj, recursive = true ) {

		if ( obj.controllers ) {

			this.controllers.forEach( ( c ) => {

				if ( c instanceof FunctionController ) return;

				if ( c._name in obj.controllers ) {

					c.load( obj.controllers[ c._name ] );

				}

			} );

		}

		if ( recursive && obj.folders ) {

			this.folders.forEach( ( f ) => {

				if ( f._title in obj.folders ) {

					f.load( obj.folders[ f._title ] );

				}

			} );

		}

		return this;

	}

	save( recursive = true ) {

		const obj = {
			controllers: {},
			folders: {}
		};

		this.controllers.forEach( ( c ) => {

			if ( c instanceof FunctionController ) return;

			if ( c._name in obj.controllers ) {

				throw new Error( `Cannot save GUI with duplicate property "${ c._name }"` );

			}

			obj.controllers[ c._name ] = c.save();

		} );

		if ( recursive ) {

			this.folders.forEach( ( f ) => {

				if ( f._title in obj.folders ) {

					throw new Error( `Cannot save GUI with duplicate folder "${ f._title }"` );

				}

				obj.folders[ f._title ] = f.save();

			} );

		}

		return obj;

	}

	open( open = true ) {

		this._setClosed( ! open );

		return this;

	}

	close() {

		return this.open( false );

	}

	_setClosed( closed ) {

		if ( this._closed === closed ) return;

		this._closed = closed;
		this._callOnOpenClose( this );
		this._invalidate();

	}

	show( show = true ) {

		this._hidden = ! show;

		if ( this.parent === undefined && this._panel ) this._panel.setVisible( show );

		this._invalidate();

		return this;

	}

	hide() {

		return this.show( false );

	}

	openAnimated( open = true ) {

		return this.open( open );

	}

	title( title ) {

		this._title = title;

		if ( this.parent === undefined && this._panel ) this._panel.setTitle( title );

		this._invalidate();

		return this;

	}

	reset( recursive = true ) {

		const controllers = recursive ? this.controllersRecursive() : this.controllers;

		controllers.forEach( ( c ) => c.reset() );

		return this;

	}

	onChange( callback ) {

		this._onChange = callback;

		return this;

	}

	_callOnChange( controller ) {

		if ( this.parent ) {

			this.parent._callOnChange( controller );

		}

		if ( this._onChange !== undefined ) {

			this._onChange.call( this, {
				object: controller.object,
				property: controller.property,
				value: controller.getValue(),
				controller
			} );

		}

	}

	onFinishChange( callback ) {

		this._onFinishChange = callback;

		return this;

	}

	_callOnFinishChange( controller ) {

		if ( this.parent ) {

			this.parent._callOnFinishChange( controller );

		}

		if ( this._onFinishChange !== undefined ) {

			this._onFinishChange.call( this, {
				object: controller.object,
				property: controller.property,
				value: controller.getValue(),
				controller
			} );

		}

	}

	onOpenClose( callback ) {

		this._onOpenClose = callback;

		return this;

	}

	_callOnOpenClose( changedGUI ) {

		if ( this.parent ) {

			this.parent._callOnOpenClose( changedGUI );

		}

		if ( this._onOpenClose !== undefined ) {

			this._onOpenClose.call( this, changedGUI );

		}

	}

	destroy() {

		if ( this.parent ) {

			this.parent.children.splice( this.parent.children.indexOf( this ), 1 );
			this.parent.folders.splice( this.parent.folders.indexOf( this ), 1 );
			this.parent._invalidate();

		} else if ( this._panel ) {

			const panel = this._panel;

			this._panel = null;
			roots.delete( this );
			panel.destroy();

		}

		Array.from( this.children ).forEach( ( c ) => c.destroy() );

	}

	controllersRecursive() {

		let controllers = Array.from( this.controllers );

		this.folders.forEach( ( f ) => {

			controllers = controllers.concat( f.controllersRecursive() );

		} );

		return controllers;

	}

	foldersRecursive() {

		let folders = Array.from( this.folders );

		this.folders.forEach( ( f ) => {

			folders = folders.concat( f.foldersRecursive() );

		} );

		return folders;

	}

	_invalidate() {

		const panel = this.root._panel;

		if ( panel ) panel.invalidate();

	}

	_forget( controller ) {

		const panel = this.root._panel;

		if ( panel ) panel.forget( controller );

	}

	_height() {

		if ( this._hidden ) return 0;

		return theme.titleHeight + ( this._closed ? 0 : this._childrenHeight() );

	}

	_childrenHeight() {

		let height = 0;
		let lastWasController = false;

		for ( const child of this.children ) {

			const h = child._height();

			if ( h === 0 ) continue;

			if ( child instanceof Controller ) {

				height += theme.spacing + h;
				lastWasController = true;

			} else {

				height += ( lastWasController ? theme.spacing : 0 ) + h;
				lastWasController = false;

			}

		}

		if ( lastWasController ) height += theme.spacing;

		return height;

	}

	_layout( ctx, x, y, w ) {

		this._x = x;
		this._y = y;
		this._w = w;

		if ( this._hidden || this._closed ) return;

		const isRoot = this.parent === undefined;
		const cx = isRoot ? x : x + theme.folderIndent + theme.folderBorder;
		const cw = isRoot ? w : w - theme.folderIndent - theme.folderBorder;

		let cy = y + theme.titleHeight;
		let lastWasController = false;

		for ( const child of this.children ) {

			const h = child._height();

			if ( h === 0 ) continue;

			if ( child instanceof Controller ) {

				cy += theme.spacing;
				child._layout( ctx, cx, cy, cw );
				lastWasController = true;

			} else {

				if ( lastWasController ) cy += theme.spacing;

				child._layout( ctx, cx, cy, cw );
				lastWasController = false;

			}

			cy += h;

		}

		if ( lastWasController ) cy += theme.spacing;

		this._childrenEnd = cy;

	}

	_drawTitle( ctx, view, y ) {

		const hover = view.isHover( this, 'title' );

		ctx.fillStyle = hover ? theme.titleHoverColor : theme.titleBackgroundColor;
		ctx.fillRect( this._x, y, this._w, theme.titleHeight );

		const cx = this._x + theme.padding + 6;
		const cy = y + theme.titleHeight / 2;

		ctx.fillStyle = theme.titleTextColor;
		ctx.beginPath();

		if ( this._closed ) {

			ctx.moveTo( cx - 2.5, cy - 4 );
			ctx.lineTo( cx + 3.5, cy );
			ctx.lineTo( cx - 2.5, cy + 4 );

		} else {

			ctx.moveTo( cx - 4, cy - 2.5 );
			ctx.lineTo( cx + 4, cy - 2.5 );
			ctx.lineTo( cx, cy + 3.5 );

		}

		ctx.closePath();
		ctx.fill();

		ctx.font = font( true );

		const textX = this._x + theme.padding + 18;

		drawText( ctx, fitText( ctx, this._title, this._w - textX - theme.padding ), textX, cy + 0.5, theme.titleTextColor );

	}

	_draw( ctx, view ) {

		if ( this._hidden ) return;

		if ( this.parent !== undefined ) this._drawTitle( ctx, view, this._y );

		if ( this._closed ) return;

		if ( this.parent !== undefined ) {

			const top = this._y + theme.titleHeight;

			ctx.fillStyle = theme.widgetColor;
			ctx.fillRect( this._x + theme.folderIndent, top, theme.folderBorder, this._childrenEnd - top );

		}

		for ( const child of this.children ) {

			if ( child._height() === 0 ) continue;

			if ( child instanceof Controller ) child._paint( ctx, view );
			else child._draw( ctx, view );

		}

	}

	_hit( x, y ) {

		if ( this._hidden ) return null;

		if ( contains( { x: this._x, y: this._y, w: this._w, h: theme.titleHeight }, x, y ) ) {

			return { node: this, part: 'title' };

		}

		if ( this._closed ) return null;

		for ( const child of this.children ) {

			if ( child._height() === 0 ) continue;

			if ( child instanceof Controller ) {

				const part = child._hitPart( x, y );

				if ( part !== null ) return { node: child, part };

			} else {

				const hit = child._hit( x, y );

				if ( hit !== null ) return hit;

			}

		}

		return null;

	}

	_pointerDown( view, part ) {

		if ( part === 'title' ) this.open( this._closed );

	}

	_pointerMove() {}

	_pointerUp() {}

	_wheel() {

		return false;

	}

	_keyDown() {

		return false;

	}

}

GUI.backend = null;

export { GUI };
