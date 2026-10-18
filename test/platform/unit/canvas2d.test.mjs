import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { assets, QUADRANTS, pixelAt } from '../helpers.mjs';

let THREE;
let platform;

before( async () => {

	THREE = await import( '@kmamal/three' )
	;( { platform } = THREE );

} );

const near = ( actual, expected, tolerance = 1 ) => {

	actual.forEach( ( value, channel ) => assert.ok( Math.abs( value - expected[ channel ] ) <= tolerance, `got ${actual} expected ${expected}` ) );

};

const loadImage = ( file ) => new THREE.ImageLoader().loadAsync( path.join( assets, file ) );

const readPixel = ( canvas, x, y ) => Array.from( canvas.getContext( '2d' ).getImageData( x, y, 1, 1 ).data );

const quadrantCanvas = () => {

	const canvas = platform.createElement( 'canvas' );
	canvas.width = 64;
	canvas.height = 64;
	const context = canvas.getContext( '2d' );
	context.fillStyle = '#ff0000';
	context.fillRect( 0, 0, 32, 32 );
	context.fillStyle = '#00ff00';
	context.fillRect( 32, 0, 32, 32 );
	context.fillStyle = '#0000ff';
	context.fillRect( 0, 32, 32, 32 );
	context.fillStyle = '#808080';
	context.fillRect( 32, 32, 32, 32 );
	return canvas;

};

describe( 'canvas creation', () => {

	it( 'createElement returns a 2D canvas with the default size', () => {

		const canvas = platform.createElement( 'canvas' );
		assert.equal( canvas.width, 300 );
		assert.equal( canvas.height, 150 );
		assert.deepEqual( canvas.style, {} );
		assert.ok( canvas.getContext( '2d' ) );

	} );

	it( 'createCanvasElement without arguments returns a 2D canvas', () => {

		const canvas = THREE.createCanvasElement();
		assert.ok( canvas.getContext( '2d' ) );

	} );

	it( 'a renderer without a window still gets the explanatory error', () => {

		assert.throws( () => new THREE.WebGLRenderer(), /needs a \{ window \}/ );

	} );

	it( 'canvases can be resized and keep drawing', () => {

		const canvas = platform.createElement( 'canvas' );
		canvas.width = 20;
		canvas.height = 10;
		const context = canvas.getContext( '2d' );
		context.fillStyle = '#123456';
		context.fillRect( 0, 0, 20, 10 );
		near( readPixel( canvas, 19, 9 ), [ 0x12, 0x34, 0x56, 255 ] );

	} );

	it( 'exposes OffscreenCanvas with convertToBlob', async () => {

		const canvas = new platform.OffscreenCanvas( 8, 8 );
		canvas.getContext( '2d' ).fillRect( 0, 0, 8, 8 );
		const blob = await canvas.convertToBlob( { type: 'image/png' } );
		assert.equal( blob.type, 'image/png' );
		assert.ok( blob.size > 0 );

	} );

	it( 'does not expose a data property, so canvases are never mistaken for raw pixels', () => {

		const canvas = platform.createElement( 'canvas' );
		assert.equal( canvas.data, undefined );
		assert.equal( new platform.OffscreenCanvas( 2, 2 ).data, undefined );

	} );

	it( 'exposes ImageData', () => {

		const data = new platform.ImageData( new Uint8ClampedArray( 16 ), 2, 2 );
		assert.equal( data.width, 2 );

	} );

	it( 'draws text', () => {

		const canvas = platform.createElement( 'canvas' );
		const context = canvas.getContext( '2d' );
		context.font = '24px sans-serif';
		assert.ok( context.measureText( 'Hello' ).width > 20 );
		context.fillStyle = '#ffffff';
		context.fillText( 'Hello', 4, 28 );
		const data = context.getImageData( 0, 0, 100, 40 ).data;
		let lit = 0;
		for ( let i = 3; i < data.length; i += 4 ) if ( data[ i ] > 0 ) lit ++;
		assert.ok( lit > 20, 'the glyphs should cover some pixels' );

	} );

} );

describe( 'platform predicates', () => {

	it( 'recognises canvases, offscreen canvases and decoded images', async () => {

		const canvas = platform.createElement( 'canvas' );
		const image = await loadImage( 'quadrants.png' );
		assert.equal( platform.isCanvas( canvas ), true );
		assert.equal( platform.isOffscreenCanvas( canvas ), true );
		assert.equal( platform.isImage( image ), true );
		assert.equal( platform.isImage( canvas ), false );
		assert.equal( platform.isCanvas( image ), false );
		assert.equal( platform.isCanvas( { width: 1, height: 1 } ), false );
		assert.equal( platform.isCanvas( null ), false );

	} );

	it( 'toDrawable turns decoded pixels into something a canvas can draw', async () => {

		const image = await loadImage( 'quadrants.png' );
		const drawable = platform.toDrawable( image );
		assert.equal( platform.isCanvas( drawable ), true );
		assert.equal( platform.toDrawable( image ), drawable, 'the conversion is cached per image' );
		const target = platform.createElement( 'canvas' );
		target.width = 128;
		target.height = 128;
		target.getContext( '2d' ).drawImage( drawable, 0, 0 );
		near( readPixel( target, 32, 32 ), QUADRANTS.topLeft );
		near( readPixel( target, 96, 32 ), QUADRANTS.topRight );
		near( readPixel( target, 32, 96 ), QUADRANTS.bottomLeft );
		near( readPixel( target, 96, 96 ), QUADRANTS.bottomRight );

	} );

	it( 'toDrawable leaves canvases alone and toImageData reads them back', () => {

		const canvas = quadrantCanvas();
		assert.equal( platform.toDrawable( canvas ), canvas );
		const data = platform.toImageData( canvas );
		assert.equal( data.width, 64 );
		near( pixelAt( data, 10, 10 ), [ 255, 0, 0, 255 ] );
		near( pixelAt( data, 50, 50 ), [ 128, 128, 128, 255 ] );
		const plain = { width: 1, height: 1, data: new Uint8Array( 4 ) };
		assert.equal( platform.toImageData( plain ), plain );

	} );

} );

describe( 'ImageUtils', () => {

	it( 'getDataURL encodes a canvas as a PNG data URL', async () => {

		const url = THREE.ImageUtils.getDataURL( quadrantCanvas() );
		assert.match( url, /^data:image\/png;base64,/ );
		const image = await new THREE.ImageLoader().loadAsync( url );
		assert.equal( image.width, 64 );
		near( pixelAt( image, 10, 10 ), [ 255, 0, 0, 255 ] );
		near( pixelAt( image, 50, 10 ), [ 0, 255, 0, 255 ] );

	} );

	it( 'getDataURL encodes decoded images and honors the requested type', async () => {

		const image = await loadImage( 'quadrants.png' );
		const png = THREE.ImageUtils.getDataURL( image );
		assert.match( png, /^data:image\/png/ );
		const decoded = await new THREE.ImageLoader().loadAsync( png );
		assert.deepEqual( pixelAt( decoded, 32, 96 ), QUADRANTS.bottomLeft );
		assert.match( THREE.ImageUtils.getDataURL( image, 'image/jpeg' ), /^data:image\/jpeg/ );

	} );

	it( 'getDataURL passes data URLs through', () => {

		const image = { src: 'data:image/png;base64,AAAA', width: 1, height: 1 };
		assert.equal( THREE.ImageUtils.getDataURL( image ), image.src );

	} );

	it( 'getDataURL encodes ImageData', async () => {

		const data = new platform.ImageData( new Uint8ClampedArray( [ 255, 0, 0, 255, 0, 255, 0, 255 ] ), 2, 1 );
		const decoded = await new THREE.ImageLoader().loadAsync( THREE.ImageUtils.getDataURL( data ) );
		assert.deepEqual( pixelAt( decoded, 0, 0 ), [ 255, 0, 0, 255 ] );
		assert.deepEqual( pixelAt( decoded, 1, 0 ), [ 0, 255, 0, 255 ] );

	} );

	it( 'sRGBToLinear converts decoded images and canvases', async () => {

		const image = await loadImage( 'quadrants.png' );
		const fromImage = THREE.ImageUtils.sRGBToLinear( image );
		assert.equal( platform.isCanvas( fromImage ), true );
		near( readPixel( fromImage, 96, 96 ), [ 55, 55, 55, 255 ], 2 );
		near( readPixel( fromImage, 32, 32 ), [ 255, 0, 0, 255 ] );
		const fromCanvas = THREE.ImageUtils.sRGBToLinear( quadrantCanvas() );
		near( readPixel( fromCanvas, 50, 50 ), [ 55, 55, 55, 255 ], 2 );

	} );

	it( 'sRGBToLinear converts raw pixel data without a canvas', () => {

		const result = THREE.ImageUtils.sRGBToLinear( { data: new Uint8Array( [ 128, 128, 128, 255 ] ), width: 1, height: 1 } );
		assert.equal( result.data[ 0 ], 55 );

	} );

} );

describe( 'CanvasTexture and serialization', () => {

	it( 'CanvasTexture wraps a 2D canvas', () => {

		const canvas = quadrantCanvas();
		const texture = new THREE.CanvasTexture( canvas );
		assert.equal( texture.image, canvas );
		assert.equal( texture.isCanvasTexture, true );
		assert.equal( texture.source.getSize( new THREE.Vector2() ).x, 64 );

	} );

	it( 'Texture.toJSON serializes a decoded image as a data URL', async () => {

		const texture = new THREE.Texture( await loadImage( 'quadrants.png' ) );
		const json = texture.toJSON( { images: {}, textures: {} } );
		const source = json.image;
		assert.ok( source, 'the texture should serialize its image' );
		const url = typeof source === 'string' ? source : source.url;
		assert.ok( url );

	} );

	it( 'Texture.toJSON serializes a canvas', () => {

		const meta = { images: {}, textures: {} };
		const json = new THREE.CanvasTexture( quadrantCanvas() ).toJSON( meta );
		const image = meta.images[ json.image ];
		assert.match( image.url, /^data:image\/png;base64,/ );

	} );

	it( 'a scene with a textured mesh survives a JSON round trip', async () => {

		const texture = new THREE.Texture( await loadImage( 'quadrants.png' ) );
		texture.needsUpdate = true;
		const mesh = new THREE.Mesh( new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial( { map: texture } ) );
		const json = JSON.parse( JSON.stringify( mesh.toJSON() ) );
		const restored = await new Promise( ( resolve, reject ) => {

			const loader = new THREE.ObjectLoader();
			loader.parse( json, resolve );
			void reject;

		} );
		const map = restored.material.map;
		assert.equal( map.image.width, 128 );
		assert.deepEqual( pixelAt( map.image, 32, 32 ), QUADRANTS.topLeft );
		assert.deepEqual( pixelAt( map.image, 96, 96 ), QUADRANTS.bottomRight );

	} );

} );

describe( 'GLTFExporter', () => {

	it( 'exports a textured mesh to a GLB that GLTFLoader reads back', async () => {

		const { GLTFExporter } = await import( '@kmamal/three/addons/exporters/GLTFExporter.js' );
		const { GLTFLoader } = await import( '@kmamal/three/addons/loaders/GLTFLoader.js' );
		const image = await loadImage( 'quadrants.png' );
		const texture = new THREE.Texture( image );
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.needsUpdate = true;
		const scene = new THREE.Scene();
		scene.add( new THREE.Mesh( new THREE.BoxGeometry(), new THREE.MeshStandardMaterial( { map: texture } ) ) );
		const glb = await new GLTFExporter().parseAsync( scene, { binary: true } );
		assert.ok( glb instanceof ArrayBuffer );
		assert.equal( new DataView( glb ).getUint32( 0, true ), 0x46546C67 );
		const gltf = await new GLTFLoader().parseAsync( glb, '' );
		let map = null;
		gltf.scene.traverse( ( child ) => {

			if ( child.isMesh ) map = child.material.map;

		} );
		assert.ok( map, 'the exported texture must come back' );
		assert.equal( map.image.width, 128 );
		assert.equal( map.flipY, false );
		near( pixelAt( map.image, 32, 32 ), QUADRANTS.bottomLeft, 1 );
		near( pixelAt( map.image, 96, 32 ), QUADRANTS.bottomRight, 1 );
		near( pixelAt( map.image, 32, 96 ), QUADRANTS.topLeft, 1 );
		near( pixelAt( map.image, 96, 96 ), QUADRANTS.topRight, 1 );

	} );

	it( 'stores a flipY texture upside down, as glTF expects, and leaves flipY=false textures alone', async () => {

		const { GLTFExporter } = await import( '@kmamal/three/addons/exporters/GLTFExporter.js' );
		const { GLTFLoader } = await import( '@kmamal/three/addons/loaders/GLTFLoader.js' );
		const exportMap = async ( flipY ) => {

			const texture = new THREE.Texture( await loadImage( 'quadrants.png' ) );
			texture.flipY = flipY;
			texture.needsUpdate = true;
			const scene = new THREE.Scene();
			scene.add( new THREE.Mesh( new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial( { map: texture } ) ) );
			const gltf = await new GLTFLoader().parseAsync( await new GLTFExporter().parseAsync( scene, { binary: true } ), '' );
			let map = null;
			gltf.scene.traverse( ( child ) => {

				if ( child.isMesh ) map = child.material.map;

			} );
			return map.image;

		};

		near( pixelAt( await exportMap( true ), 32, 32 ), QUADRANTS.bottomLeft, 1 );
		near( pixelAt( await exportMap( false ), 32, 32 ), QUADRANTS.topLeft, 1 );

	} );

	it( 'exports a canvas texture', async () => {

		const { GLTFExporter } = await import( '@kmamal/three/addons/exporters/GLTFExporter.js' );
		const { GLTFLoader } = await import( '@kmamal/three/addons/loaders/GLTFLoader.js' );
		const texture = new THREE.CanvasTexture( quadrantCanvas() );
		const scene = new THREE.Scene();
		scene.add( new THREE.Mesh( new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial( { map: texture } ) ) );
		const glb = await new GLTFExporter().parseAsync( scene, { binary: true } );
		const gltf = await new GLTFLoader().parseAsync( glb, '' );
		let map = null;
		gltf.scene.traverse( ( child ) => {

			if ( child.isMesh ) map = child.material.map;

		} );
		assert.equal( map.image.width, 64 );
		near( pixelAt( map.image, 10, 10 ), [ 0, 0, 255, 255 ], 2 );
		near( pixelAt( map.image, 10, 50 ), [ 255, 0, 0, 255 ], 2 );

	} );

	it( 'exports JSON glTF with embedded data URIs', async () => {

		const { GLTFExporter } = await import( '@kmamal/three/addons/exporters/GLTFExporter.js' );
		const scene = new THREE.Scene();
		scene.add( new THREE.Mesh( new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial( { map: new THREE.CanvasTexture( quadrantCanvas() ) } ) ) );
		const gltf = await new GLTFExporter().parseAsync( scene, { binary: false } );
		assert.equal( gltf.asset.version, '2.0' );
		assert.ok( gltf.images.length === 1 );
		assert.ok( gltf.buffers[ 0 ].uri.startsWith( 'data:' ) );

	} );

} );

describe( 'SVGLoader gradients', () => {

	const svg = '<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs><rect width="100" height="50" fill="url(#g)"/></svg>';

	it( 'bakes a linear gradient into a canvas texture', async () => {

		const { SVGLoader } = await import( '@kmamal/three/addons/loaders/SVGLoader.js' );
		const { paths } = new SVGLoader().parse( svg );
		assert.equal( paths.length, 1 );
		assert.match( paths[ 0 ].userData.style.fill, /url\(#g\)/ );
		const material = SVGLoader.createFillMaterial( paths[ 0 ] );
		const { map } = material;
		assert.ok( map && map.isCanvasTexture, 'the gradient must be a canvas texture' );
		assert.equal( platform.isCanvas( map.image ), true );
		const canvas = map.image;
		assert.ok( canvas.width >= 64 );
		const left = readPixel( canvas, 1, 0 );
		const right = readPixel( canvas, canvas.width - 2, 0 );
		assert.ok( left[ 0 ] > 200 && left[ 2 ] < 60, `left should be red, got ${left}` );
		assert.ok( right[ 2 ] > 200 && right[ 0 ] < 60, `right should be blue, got ${right}` );
		const middle = readPixel( canvas, Math.floor( canvas.width / 2 ), 0 );
		assert.ok( middle[ 0 ] > 80 && middle[ 2 ] > 80, `the middle should blend both, got ${middle}` );

	} );

	it( 'bakes the gradients of a real sample file', async () => {

		const { SVGLoader } = await import( '@kmamal/three/addons/loaders/SVGLoader.js' );
		const fs = await import( 'node:fs' );
		const text = fs.readFileSync( path.resolve( import.meta.dirname, '../../../examples/models/svg/blueprint.svg' ), 'utf8' );
		const { paths } = new SVGLoader().parse( text );
		let baked = 0;
		for ( const shapePath of paths ) {

			if ( /url\(/.test( shapePath.userData.style.fill ?? '' ) ) {

				const { map } = SVGLoader.createFillMaterial( shapePath );
				if ( map && map.isCanvasTexture ) baked ++;

			}

		}

		assert.ok( baked > 0, 'blueprint.svg uses gradient fills' );

	} );

} );

describe( 'addons that draw to canvases', () => {

	it( 'Lut.createCanvas renders the color map', async () => {

		const { Lut } = await import( '@kmamal/three/addons/math/Lut.js' );
		const canvas = new Lut( 'rainbow', 64 ).createCanvas();
		assert.equal( platform.isCanvas( canvas ), true );
		assert.equal( canvas.height, 64 );
		const top = readPixel( canvas, 0, 0 );
		const bottom = readPixel( canvas, 0, 63 );
		assert.ok( top[ 0 ] > 200 && top[ 2 ] < 40, `the first entry is red-ish, got ${top}` );
		assert.ok( bottom[ 2 ] > 200 && bottom[ 0 ] < 40, `the last entry is blue, got ${bottom}` );

	} );

	it( 'FlakesTexture draws a normal-map style canvas', async () => {

		const { FlakesTexture } = await import( '@kmamal/three/addons/textures/FlakesTexture.js' );
		const canvas = new FlakesTexture();
		assert.equal( canvas.width, 512 );
		assert.equal( platform.isCanvas( canvas ), true );
		const { data } = canvas.getContext( '2d' ).getImageData( 0, 0, canvas.width, canvas.height );
		const mean = [ 0, 0, 0 ];
		for ( let i = 0; i < data.length; i += 4 ) for ( let c = 0; c < 3; c ++ ) mean[ c ] += data[ i + c ];
		const count = data.length / 4;
		const [ r, g, b ] = mean.map( ( value ) => value / count );
		assert.ok( Math.abs( r - 127 ) < 25 && Math.abs( g - 127 ) < 25 && b > 200, `a mostly flat normal map is bluish, got ${r.toFixed( 0 )},${g.toFixed( 0 )},${b.toFixed( 0 )}` );

	} );

	it( 'UVsDebug draws the uv layout of a geometry', async () => {

		const { UVsDebug } = await import( '@kmamal/three/addons/utils/UVsDebug.js' );
		const canvas = UVsDebug( new THREE.PlaneGeometry( 1, 1 ) );
		assert.equal( platform.isCanvas( canvas ), true );
		const data = canvas.getContext( '2d' ).getImageData( 0, 0, canvas.width, canvas.height ).data;
		let drawn = 0;
		for ( let i = 3; i < data.length; i += 4 ) if ( data[ i ] > 0 ) drawn ++;
		assert.ok( drawn > 1000, `the triangles and labels should cover pixels, got ${drawn}` );

	} );

	it( 'LUTImageLoader reads a color lookup image into a 3D lut', async () => {

		const { LUTImageLoader } = await import( '@kmamal/three/addons/loaders/LUTImageLoader.js' );
		const lut = await new LUTImageLoader().loadAsync( path.resolve( import.meta.dirname, '../../../examples/luts/B&WLUT.png' ) );
		assert.ok( lut.size >= 8, `lut size ${lut.size}` );
		assert.ok( lut.texture3D && lut.texture3D.isData3DTexture );
		assert.equal( lut.texture3D.image.width, lut.size );

	} );

	it( 'draws text with generic and aliased font families', ( t ) => {

		const draw = ( font ) => {

			const canvas = platform.createElement( 'canvas' );
			canvas.width = 120;
			canvas.height = 30;
			const context = canvas.getContext( '2d' );
			context.fillStyle = '#000000';
			context.font = font;
			context.fillText( 'Hello', 2, 20 );
			const { data } = context.getImageData( 0, 0, 120, 30 );
			return Buffer.from( data );

		};

		const reference = draw( '16px Liberation Sans' );
		if ( ! reference.some( ( value ) => value > 0 ) ) return t.skip( 'Liberation Sans is not installed' );
		for ( const font of [ '16px arial', '16px Arial' ] ) {

			assert.deepEqual( draw( font ), reference, `${font} should resolve to the same font` );

		}

	} );

	it( 'drawImage and createPattern accept loaded images directly', async () => {

		const image = await loadImage( 'quadrants.png' );
		const canvas = platform.createElement( 'canvas' );
		canvas.width = image.width;
		canvas.height = image.height;
		const context = canvas.getContext( '2d' );
		context.drawImage( image, 0, 0 );
		near( readPixel( canvas, Math.floor( image.width / 4 ), Math.floor( image.height / 4 ) ), QUADRANTS.topLeft );
		near( readPixel( canvas, Math.floor( 3 * image.width / 4 ), Math.floor( 3 * image.height / 4 ) ), QUADRANTS.bottomRight );
		context.fillStyle = context.createPattern( image, 'repeat' );
		context.fillRect( 0, 0, 4, 4 );

	} );

} );
