import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { hasDisplay, createHarness } from './harness.mjs';

const root = path.resolve( import.meta.dirname, '../../..' );
const transcoderPath = path.join( root, 'examples/jsm/libs/basis/' );
const file = path.join( root, 'examples/textures/spiritedaway.ktx2' );

describe( 'KTX2 textures on WebGLRenderer', { skip: ! hasDisplay && 'needs a display and GPU' }, () => {

	let harness;
	let KTX2Loader;

	before( async () => {

		harness = await createHarness( { name: 'WebGLRenderer', webgpu: false, bottomUp: true } )
		;( { KTX2Loader } = await import( '@kmamal/three/addons/loaders/KTX2Loader.js' ) );

	} );
	after( async () => {

		await harness.dispose();

	} );

	const meanColor = ( image ) => {

		const sum = [ 0, 0, 0 ];
		const count = image.width * image.height;
		for ( let i = 0; i < image.data.length; i += 4 ) for ( let c = 0; c < 3; c ++ ) sum[ c ] += image.data[ i + c ];
		return sum.map( ( value ) => value / count );

	};

	const renderLayer = async ( texture, layer ) => {

		const { THREE, renderToImage } = harness;
		const material = new THREE.ShaderMaterial( {
			glslVersion: THREE.GLSL3,
			uniforms: { map: { value: texture } },
			vertexShader: 'out vec2 vUv; void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }',
			fragmentShader: `precision highp float; precision highp sampler2DArray; uniform sampler2DArray map; in vec2 vUv; out vec4 color; void main() { color = texture( map, vec3( vUv, ${layer}.0 ) ); }`,
		} );
		const scene = new THREE.Scene();
		scene.add( new THREE.Mesh( new THREE.PlaneGeometry( 2, 2 ), material ) );
		const camera = new THREE.OrthographicCamera( - 1, 1, 1, - 1, 0.1, 10 );
		return renderToImage( scene, camera );

	};

	it( 'is transcoded to a compressed format when the context supports one', async () => {

		const { THREE, renderer } = harness;
		const loader = new KTX2Loader().setTranscoderPath( transcoderPath ).detectSupport( renderer );
		try {

			const texture = await loader.loadAsync( file );
			assert.notEqual( texture.format, THREE.RGBAFormat, 'expected a compressed format' );
			assert.equal( texture.isCompressedArrayTexture, true );
			const gl = renderer.getContext();
			while ( gl.getError() !== gl.NO_ERROR );
			renderer.initTexture( texture );
			assert.equal( gl.getError(), gl.NO_ERROR, 'uploading the compressed texture must not raise a GL error' );

		} finally {

			loader.dispose();

		}

	} );

	it( 'renders close to its uncompressed transcode', async () => {

		const { renderer } = harness;
		const compressedLoader = new KTX2Loader().setTranscoderPath( transcoderPath ).detectSupport( renderer );
		const plainLoader = new KTX2Loader().setTranscoderPath( transcoderPath ).detectSupport( { extensions: { has: () => false } } );
		try {

			const compressed = await compressedLoader.loadAsync( file );
			const plain = await plainLoader.loadAsync( file );
			const compressedImage = await renderLayer( compressed, 0 );
			const plainImage = await renderLayer( plain, 0 );
			const a = meanColor( compressedImage );
			const b = meanColor( plainImage );
			a.forEach( ( value, channel ) => assert.ok( Math.abs( value - b[ channel ] ) < 12, `channel ${channel}: compressed ${value.toFixed( 1 )} vs uncompressed ${b[ channel ].toFixed( 1 )}` ) );
			assert.ok( a.some( ( value ) => value > 5 ), 'the render should not be black' );

		} finally {

			compressedLoader.dispose();
			plainLoader.dispose();

		}

	} );

} );
