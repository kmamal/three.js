import path from 'node:path';
import { createRequire } from 'node:module';

export const assets = path.join( import.meta.dirname, 'assets' );
export const hasDisplay = Boolean( process.env.DISPLAY || process.env.WAYLAND_DISPLAY ) && process.env.SDL_THREE_NO_RENDER_TESTS !== '1';
export const require = createRequire( import.meta.url );

export const QUADRANTS = {
	topLeft: [ 255, 0, 0, 255 ],
	topRight: [ 0, 255, 0, 255 ],
	bottomLeft: [ 0, 0, 255, 255 ],
	bottomRight: [ 128, 128, 128, 255 ],
};

export const pixelAt = ( image, x, y ) => Array.from( image.data.slice( ( y * image.width + x ) * 4, ( y * image.width + x ) * 4 + 4 ) );

export const sampleQuadrants = ( read, width, height ) => ( {
	topLeft: read( Math.floor( width / 4 ), Math.floor( height / 4 ) ),
	topRight: read( Math.floor( 3 * width / 4 ), Math.floor( height / 4 ) ),
	bottomLeft: read( Math.floor( width / 4 ), Math.floor( 3 * height / 4 ) ),
	bottomRight: read( Math.floor( 3 * width / 4 ), Math.floor( 3 * height / 4 ) ),
} );
