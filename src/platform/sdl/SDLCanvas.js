import { createRequire } from 'node:module';
import { bindWindowEvents } from './SDLEvents.js';
import { SDLEventTarget, getDocument } from './SDLDocument.js';

const require = createRequire( import.meta.url );

class SDLStyle {

	constructor() {

		this.display = '';
		this.width = '';
		this.height = '';
		this.cursor = '';
		this.touchAction = '';

	}

}

class SDLGPUContext {

	constructor( canvas ) {

		this.canvas = canvas;
		this._renderer = null;

	}

	configure( { device, format, usage } ) {

		this._renderer = this.canvas.getGPURenderer( device, format, usage );

	}

	unconfigure() {

		this._renderer = null;

	}

	getCurrentTexture() {

		const canvas = this.canvas;
		let texture = this._renderer.getCurrentTexture();

		if ( canvas._matchesWindow() && ( texture.width !== canvas._width || texture.height !== canvas._height ) ) {

			canvas._configureSurface();
			texture = this._renderer.getCurrentTexture();

		}

		return texture;

	}

}

class SDLCanvas extends SDLEventTarget {

	constructor( window ) {

		super();

		this.window = window;
		this.style = new SDLStyle();
		this.classList = { add() {}, remove() {}, toggle() {}, contains: () => false };
		this.dataset = {};
		this.ownerDocument = getDocument( window );
		this._width = window.pixelWidth;
		this._height = window.pixelHeight;
		this._gl = null;
		this._gpuRenderer = null;
		this._presentPending = false;
		this._surfaceWidth = - 1;
		this._surfaceHeight = - 1;
		this._unbindEvents = bindWindowEvents( this, window );

	}

	get width() {

		return this._width;

	}

	set width( value ) {

		if ( value === this._width ) {

			this._syncSurface();
			return;

		}

		this._width = value;
		this._resize();

	}

	get height() {

		return this._height;

	}

	set height( value ) {

		if ( value === this._height ) {

			this._syncSurface();
			return;

		}

		this._height = value;
		this._resize();

	}

	get clientWidth() {

		return this.window.width;

	}

	get clientHeight() {

		return this.window.height;

	}

	getBoundingClientRect() {

		const { width, height } = this.window;
		return { left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 };

	}

	get parentElement() {

		return this.ownerDocument.body;

	}

	setAttribute() {}

	getAttribute() {

		return null;

	}

	removeAttribute() {}

	getRootNode() {

		return this.ownerDocument;

	}

	focus() {}

	get offsetWidth() {

		return this.clientWidth;

	}

	get offsetHeight() {

		return this.clientHeight;

	}

	get offsetLeft() {

		return 0;

	}

	get offsetTop() {

		return 0;

	}

	requestPointerLock() {

		this.ownerDocument._lockPointer( this );

	}

	setPointerCapture() {}

	releasePointerCapture() {}

	getContext( type, attributes = {} ) {

		if ( type === 'webgpu' ) return new SDLGPUContext( this );

		if ( type === 'webgl2' ) {

			if ( this._gl !== null ) return this._gl;

			const createContext = require( '@kmamal/gl' );

			const gl = createContext( this._width, this._height, {
				...attributes,
				window: this.window,
				createWebGL2Context: true,
			} );

			if ( gl === null ) return null;

			gl.canvas = this;
			this._gl = gl;
			return gl;

		}

		return null;

	}

	getGPURenderer( device, format, usage ) {

		if ( this._gpuRenderer === null ) {

			const gpu = require( '@kmamal/gpu' );

			this._gpuRenderer = gpu.renderGPUDeviceToWindow( {
				device,
				window: this.window,
				format: format ?? 'bgra8unorm',
				usage: usage ?? gpu.GPUTextureUsage.RENDER_ATTACHMENT,
			} );

			this._surfaceWidth = this.window.pixelWidth;
			this._surfaceHeight = this.window.pixelHeight;

		}

		return this._gpuRenderer;

	}

	present() {

		this.ownerDocument.markPresented();

		if ( this._presentPending === true ) return;

		this._presentPending = true;

		queueMicrotask( () => {

			this._presentPending = false;

			if ( this.window.destroyed ) return;

			if ( this._gl !== null ) {

				this._gl.swap();

			} else if ( this._gpuRenderer !== null ) {

				this._gpuRenderer.swap();

			}

		} );

	}

	_resize() {

		if ( this._gl !== null ) this._gl.getExtension( 'STACKGL_resize_drawingbuffer' ).resize( this._width, this._height );
		if ( this._gpuRenderer !== null ) this._configureSurface();

	}

	_matchesWindow() {

		return this.window.pixelWidth === this._width && this.window.pixelHeight === this._height;

	}

	_syncSurface() {

		if ( this._gpuRenderer === null ) return;

		if ( this.window.pixelWidth !== this._surfaceWidth || this.window.pixelHeight !== this._surfaceHeight ) this._configureSurface();

	}

	_configureSurface() {

		this._gpuRenderer.resize();
		this._surfaceWidth = this.window.pixelWidth;
		this._surfaceHeight = this.window.pixelHeight;

	}

}

export { SDLCanvas };
