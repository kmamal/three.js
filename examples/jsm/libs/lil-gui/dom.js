function createElementStub( onVisibility = null ) {

	const style = new Proxy( {}, {

		set( target, property, value ) {

			target[ property ] = value;

			if ( onVisibility !== null ) {

				if ( property === 'visibility' ) onVisibility( value !== 'hidden' );
				if ( property === 'display' ) onVisibility( value !== 'none' );

			}

			return true;

		}

	} );

	const noop = () => {};

	return {
		style,
		classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
		addEventListener: noop,
		removeEventListener: noop,
		appendChild: noop,
		removeChild: noop,
		setAttribute: noop,
		getBoundingClientRect: () => ( { x: 0, y: 0, left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 } )
	};

}

export { createElementStub };
