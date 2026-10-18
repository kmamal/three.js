import { platform } from '../platform/Platform.js';

let _context;

/**
 * Manages the global audio context in the engine.
 *
 * @hideconstructor
 */
class AudioContext {

	/**
	 * Returns the global native audio context.
	 *
	 * @return {Window.AudioContext} The native audio context.
	 */
	static getContext() {

		if ( _context === undefined ) {

			_context = new platform.AudioContext();

		}

		return _context;

	}

	/**
	 * Allows to set the global native audio context from outside.
	 *
	 * @param {Window.AudioContext} value - The native context to set.
	 */
	static setContext( value ) {

		_context = value;

	}

}

export { AudioContext };
