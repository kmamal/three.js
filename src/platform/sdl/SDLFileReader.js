class SDLFileReader extends EventTarget {

	constructor() {

		super();

		this.result = null;
		this.error = null;
		this.readyState = 0;
		this.onload = null;
		this.onerror = null;
		this.onloadend = null;

	}

	readAsArrayBuffer( blob ) {

		this._read( blob.arrayBuffer() );

	}

	readAsText( blob ) {

		this._read( blob.text() );

	}

	readAsDataURL( blob ) {

		this._read( blob.arrayBuffer().then( ( buffer ) => `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from( buffer ).toString( 'base64' )}` ) );

	}

	_read( promise ) {

		this.readyState = 1;

		promise.then( ( result ) => {

			this.result = result;
			this.readyState = 2;
			this._emit( 'load' );

		}, ( error ) => {

			this.error = error;
			this.readyState = 2;
			this._emit( 'error' );

		} ).then( () => this._emit( 'loadend' ) );

	}

	_emit( type ) {

		this.dispatchEvent( new Event( type ) );
		const handler = this[ `on${type}` ];
		if ( typeof handler === 'function' ) handler.call( this, new Event( type ) );

	}

}

export { SDLFileReader };
