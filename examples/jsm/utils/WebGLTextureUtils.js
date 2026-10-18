import {
	PlaneGeometry,
	ShaderMaterial,
	Uniform,
	Mesh,
	PerspectiveCamera,
	Scene,
	WebGLRenderTarget,
	CanvasTexture,
	SRGBColorSpace,
	platform
} from '@kmamal/three';

/**
 * @module WebGLTextureUtils
 * @three_import import * as WebGLTextureUtils from '@kmamal/three/addons/utils/WebGLTextureUtils.js';
 */

let fullscreenQuadGeometry;
let fullscreenQuadMaterial;
let fullscreenQuad;

/**
 * Returns an uncompressed version of the given compressed texture.
 *
 * This module can only be used with {@link WebGLRenderer}. When using {@link WebGPURenderer},
 * import the function from {@link module:WebGPUTextureUtils}.
 *
 * @param {CompressedTexture} texture - The compressed texture.
 * @param {number} [maxTextureSize=Infinity] - The maximum size of the uncompressed texture.
 * @param {?WebGLRenderer} [renderer=null] - A reference to a renderer.
 * @return {CanvasTexture} The uncompressed texture.
 */
export function decompress( texture, maxTextureSize = Infinity, renderer = null ) {

	if ( ! fullscreenQuadGeometry ) fullscreenQuadGeometry = new PlaneGeometry( 2, 2, 1, 1 );
	if ( ! fullscreenQuadMaterial ) fullscreenQuadMaterial = new ShaderMaterial( {
		uniforms: { blitTexture: new Uniform( texture ) },
		vertexShader: `
			varying vec2 vUv;
			void main(){
				vUv = uv;
				gl_Position = vec4(position.xy * 1.0,0.,.999999);
			}`,
		fragmentShader: `
			uniform sampler2D blitTexture; 
			varying vec2 vUv;

			void main(){ 
				gl_FragColor = vec4(vUv.xy, 0, 1);
				
				#ifdef IS_SRGB
				gl_FragColor = sRGBTransferOETF( texture2D( blitTexture, vUv) );
				#else
				gl_FragColor = texture2D( blitTexture, vUv);
				#endif
			}`
	} );

	fullscreenQuadMaterial.uniforms.blitTexture.value = texture;
	fullscreenQuadMaterial.defines.IS_SRGB = texture.colorSpace == SRGBColorSpace;
	fullscreenQuadMaterial.needsUpdate = true;

	if ( ! fullscreenQuad ) {

		fullscreenQuad = new Mesh( fullscreenQuadGeometry, fullscreenQuadMaterial );
		fullscreenQuad.frustumCulled = false;

	}

	const _camera = new PerspectiveCamera();
	const _scene = new Scene();
	_scene.add( fullscreenQuad );

	if ( renderer === null ) {

		throw new Error( 'WebGLTextureUtils: Under SDL decompress() needs a renderer.' );

	}

	const width = Math.min( texture.image.width, maxTextureSize );
	const height = Math.min( texture.image.height, maxTextureSize );

	const renderTarget = new WebGLRenderTarget( width, height );
	const previousTarget = renderer.getRenderTarget();

	renderer.setRenderTarget( renderTarget );
	renderer.clear();
	renderer.render( _scene, _camera );
	renderer.setRenderTarget( previousTarget );

	const pixels = new Uint8Array( width * height * 4 );
	renderer.readRenderTargetPixels( renderTarget, 0, 0, width, height, pixels );
	renderTarget.dispose();

	const canvas = platform.createElement( 'canvas' );
	const context = canvas.getContext( '2d' );

	canvas.width = width;
	canvas.height = height;

	const imageData = context.createImageData( width, height );
	const rowLength = width * 4;

	for ( let y = 0; y < height; y ++ ) {

		imageData.data.set( pixels.subarray( ( height - 1 - y ) * rowLength, ( height - y ) * rowLength ), y * rowLength );

	}

	context.putImageData( imageData, 0, 0 );

	const readableTexture = new CanvasTexture( canvas );

	readableTexture.minFilter = texture.minFilter;
	readableTexture.magFilter = texture.magFilter;
	readableTexture.wrapS = texture.wrapS;
	readableTexture.wrapT = texture.wrapT;
	readableTexture.colorSpace = texture.colorSpace;
	readableTexture.name = texture.name;

	return readableTexture;

}
