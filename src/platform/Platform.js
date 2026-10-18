import { sdlPlatform } from './sdl/SDLPlatform.js';

const platform = {};

Object.defineProperties( platform, Object.getOwnPropertyDescriptors( sdlPlatform ) );

function setPlatform( implementation ) {

	Object.defineProperties( platform, Object.getOwnPropertyDescriptors( implementation ) );

}

export { platform, setPlatform };
