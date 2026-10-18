let frameTimer = null;
const frameCallbacks = new Map();
let nextFrameId = 1;

const pump = () => {

	frameTimer = null;

	const callbacks = [ ...frameCallbacks.values() ];
	frameCallbacks.clear();

	const timestamp = performance.now();
	for ( const callback of callbacks ) {

		try {

			callback( timestamp );

		} catch ( error ) {

			queueMicrotask( () => {

				throw error;

			} );

		}

	}

};

const animationContext = {

	requestAnimationFrame( callback ) {

		const id = nextFrameId ++;
		frameCallbacks.set( id, callback );
		if ( frameTimer === null ) frameTimer = setImmediate( pump );
		return id;

	},

	cancelAnimationFrame( id ) {

		frameCallbacks.delete( id );

	}

};

export { animationContext };
