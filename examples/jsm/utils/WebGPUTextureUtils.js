import {
	QuadMesh,
	NodeMaterial,
	RenderTarget,
	CanvasTexture,
	platform
} from '@kmamal/three/webgpu';
import { texture, uv } from '@kmamal/three/tsl';

/**
 * @module WebGPUTextureUtils
 * @three_import import * as WebGPUTextureUtils from '@kmamal/three/addons/utils/WebGPUTextureUtils.js';
 */

const _quadMesh = /*@__PURE__*/ new QuadMesh();

/**
 * Returns an uncompressed version of the given compressed texture.
 *
 * This module can only be used with {@link WebGPURenderer}. When using {@link WebGLRenderer},
 * import the function from {@link module:WebGLTextureUtils}.
 *
 * @async
 * @param {CompressedTexture} blitTexture - The compressed texture.
 * @param {number} [maxTextureSize=Infinity] - The maximum size of the uncompressed texture.
 * @param {?WebGPURenderer} [renderer=null] - A reference to a renderer.
 * @return {Promise<CanvasTexture>} A Promise that resolved with the uncompressed texture.
 */
export async function decompress( blitTexture, maxTextureSize = Infinity, renderer = null ) {

	if ( renderer === null ) {

		throw new Error( 'WebGPUTextureUtils: Under SDL decompress() needs a renderer.' );

	}

	const material = new NodeMaterial();

	material.fragmentNode = texture( blitTexture, uv().flipY() );

	const width = Math.min( blitTexture.image.width, maxTextureSize );
	const height = Math.min( blitTexture.image.height, maxTextureSize );

	const renderTarget = new RenderTarget( width, height );
	renderTarget.texture.colorSpace = blitTexture.colorSpace;

	const previousTarget = renderer.getRenderTarget();

	renderer.setRenderTarget( renderTarget );

	_quadMesh.material = material;
	_quadMesh.render( renderer );

	renderer.setRenderTarget( previousTarget );

	const pixels = await renderer.readRenderTargetPixelsAsync( renderTarget, 0, 0, width, height );

	renderTarget.dispose();
	material.dispose();

	const canvas = platform.createElement( 'canvas' );
	const context = canvas.getContext( '2d' );

	canvas.width = width;
	canvas.height = height;

	const imageData = context.createImageData( width, height );
	const rowLength = width * 4;
	const bytesPerRow = Math.ceil( rowLength / 256 ) * 256;
	const bytes = new Uint8Array( pixels.buffer, pixels.byteOffset, pixels.byteLength );

	for ( let y = 0; y < height; y ++ ) {

		imageData.data.set( bytes.subarray( y * bytesPerRow, y * bytesPerRow + rowLength ), y * rowLength );

	}

	context.putImageData( imageData, 0, 0 );

	const readableTexture = new CanvasTexture( canvas );

	readableTexture.minFilter = blitTexture.minFilter;
	readableTexture.magFilter = blitTexture.magFilter;
	readableTexture.wrapS = blitTexture.wrapS;
	readableTexture.wrapT = blitTexture.wrapT;
	readableTexture.colorSpace = blitTexture.colorSpace;
	readableTexture.name = blitTexture.name;

	return readableTexture;

}
