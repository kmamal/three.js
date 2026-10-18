import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const models = path.resolve( import.meta.dirname, '../../../examples/models' );

let THREE;

before( async () => {

	THREE = await import( '@kmamal/three' );

} );

const countMeshes = ( object ) => {

	let meshes = 0;
	let vertices = 0;
	object.traverse( ( child ) => {

		if ( child.isMesh ) {

			meshes ++;
			vertices += child.geometry.attributes.position.count;

		}

	} );
	return { meshes, vertices };

};

describe( 'DOMParser based loaders', () => {

	it( 'FileLoader parses XML for the document response type', async () => {

		const loader = new THREE.FileLoader();
		loader.setResponseType( 'document' );
		loader.setMimeType( 'image/svg+xml' );
		const document = await loader.loadAsync( path.join( models, 'svg/hexagon.svg' ) );
		assert.equal( document.documentElement.nodeName, 'svg' );

	} );

	describe( 'SVGLoader', () => {

		let SVGLoader;

		before( async () => {

			( { SVGLoader } = await import( '@kmamal/three/addons/loaders/SVGLoader.js' ) );

		} );

		const parse = ( name ) => new SVGLoader().parse( fs.readFileSync( path.join( models, 'svg', name ), 'utf8' ) );

		it( 'reads paths and their fill colors', () => {

			const { paths } = parse( 'hexagon.svg' );
			assert.equal( paths.length, 1 );
			assert.equal( paths[ 0 ].subPaths.length, 1 );
			assert.ok( paths[ 0 ].color.isColor );

		} );

		it( 'reads presentation attributes and inline styles', () => {

			const { paths } = parse( 'styled-paths.svg' );
			assert.equal( paths.length, 4 );
			assert.deepEqual( paths.map( ( p ) => p.userData.style.fill ), [ 'none', 'none', '#fff', 'none' ] );
			const inline = paths[ 3 ].userData.style;
			assert.match( inline.stroke, /^(#000000|rgb\(0, 0, 0\))$/ );
			assert.equal( inline.strokeLineCap, 'round' );
			assert.equal( inline.strokeLineJoin, 'bevel' );
			assert.equal( inline.strokeMiterLimit, 10 );
			assert.ok( Math.abs( inline.strokeWidth - 1.92 ) < 1e-6, `stroke width is scaled by the group transform, got ${inline.strokeWidth}` );

		} );

		it( 'applies CSS classes from style sheets', () => {

			const { paths } = parse( 'multiple-css-classes.svg' );
			assert.deepEqual( paths.map( ( p ) => p.userData.style.fill ), [ 'red', '#000', 'red' ] );
			assert.deepEqual( paths.map( ( p ) => p.userData.style.stroke ), [ undefined, 'green', 'green' ] );
			assert.equal( paths[ 0 ].color.getHexString(), 'ff0000' );

		} );

		it( 'applies style sheets declared inside defs, with CDATA', () => {

			const { paths } = parse( 'style-css-inside-defs.svg' );
			assert.equal( paths.length, 1 );
			assert.equal( paths[ 0 ].userData.style.fill.toLowerCase(), '#ff9900' );
			assert.equal( paths[ 0 ].userData.style.stroke.toLowerCase(), '#ff0000' );
			assert.equal( paths[ 0 ].userData.style.strokeWidth > 0, true );

		} );

		it( 'parses a large file with many paths and converts them to shapes', () => {

			const { paths } = parse( 'tiger.svg' );
			assert.ok( paths.length > 100, `tiger has many paths, got ${paths.length}` );
			let shapes = 0;
			for ( const p of paths ) shapes += SVGLoader.createShapes( p ).length;
			assert.ok( shapes > 50 );

		} );

		it( 'reads a compact single-path document', () => {

			const { paths } = parse( 'emoji.svg' );
			assert.equal( paths.length, 1 );
			assert.ok( paths[ 0 ].subPaths.length > 0 );

		} );

		it( 'resolves xlink references to ids', () => {

			const text = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="a" d="M0 0 L10 0 L10 10 Z"/></defs><use xlink:href="#a" x="5"/></svg>';
			const { paths } = new SVGLoader().parse( text );
			assert.equal( paths.length, 1 );

		} );

	} );

	it( 'ColladaLoader loads a model with textures', async () => {

		const { ColladaLoader } = await import( '@kmamal/three/addons/loaders/ColladaLoader.js' );
		const collada = await new ColladaLoader().loadAsync( path.join( models, 'collada/pump/pump.dae' ) );
		const { meshes, vertices } = countMeshes( collada.scene );
		assert.ok( meshes > 0 && vertices > 100, `meshes ${meshes}, vertices ${vertices}` );

	} );

	it( 'ColladaLoader resolves kinematics joints through element ids', async () => {

		const { ColladaLoader } = await import( '@kmamal/three/addons/loaders/ColladaLoader.js' );
		const collada = await new ColladaLoader().loadAsync( path.join( models, 'collada/abb_irb52_7_120.dae' ) );
		assert.equal( countMeshes( collada.scene ).meshes, 7 );
		assert.ok( collada.kinematics, 'the kinematics model must be built' );
		assert.ok( Object.keys( collada.kinematics.joints ).length >= 6, `joints: ${Object.keys( collada.kinematics.joints ).length}` );

	} );

	it( 'AMFLoader loads a mesh', async () => {

		const { AMFLoader } = await import( '@kmamal/three/addons/loaders/AMFLoader.js' );
		const amf = await new AMFLoader().loadAsync( path.join( models, 'amf/rook.amf' ) );
		const { meshes, vertices } = countMeshes( amf );
		assert.ok( meshes > 0 && vertices > 100, `meshes ${meshes}, vertices ${vertices}` );

	} );

	it( '3MFLoader loads meshes from a zipped package', async () => {

		const { ThreeMFLoader } = await import( '@kmamal/three/addons/loaders/3MFLoader.js' );
		const group = await new ThreeMFLoader().loadAsync( path.join( models, '3mf/cube_gears.3mf' ) );
		const { meshes, vertices } = countMeshes( group );
		assert.equal( meshes, 17 );
		assert.equal( vertices, 12864 );

	} );

	it( '3MFLoader reads namespaced color groups into vertex colors', async () => {

		const { ThreeMFLoader } = await import( '@kmamal/three/addons/loaders/3MFLoader.js' );
		const group = await new ThreeMFLoader().loadAsync( path.join( models, '3mf/facecolors.3mf' ) );
		let colored = 0;
		group.traverse( ( child ) => {

			if ( child.isMesh && child.geometry.attributes.color ) colored ++;

		} );
		assert.ok( colored > 0, 'the <m:colorgroup> resources must be found' );

	} );

	it( 'VTKLoader reads an XML PolyData file', async () => {

		const { VTKLoader } = await import( '@kmamal/three/addons/loaders/VTKLoader.js' );
		const geometry = await new VTKLoader().loadAsync( path.join( import.meta.dirname, '../assets/quad.vtp' ) );
		assert.deepEqual( Array.from( geometry.attributes.position.array ), [ 0, 0, 0, 2, 0, 0, 2, 3, 0, 0, 3, 0 ] );
		assert.deepEqual( Array.from( geometry.index.array ), [ 0, 1, 2, 0, 2, 3 ] );
		assert.equal( geometry.attributes.normal.count, 4 );
		assert.deepEqual( Array.from( geometry.attributes.normal.array.slice( 0, 3 ) ), [ 0, 0, 1 ] );

	} );

	it( 'MaterialXLoader builds node materials from the sample files', async () => {

		const { MaterialXLoader } = await import( '@kmamal/three/addons/loaders/MaterialXLoader.js' );
		const root = path.resolve( import.meta.dirname, '../../../examples/materialx' );
		const files = fs.readdirSync( root ).filter( ( name ) => name.endsWith( '.mtlx' ) );
		assert.ok( files.length >= 25 );
		for ( const file of files ) {

			const { materials } = await new MaterialXLoader().setPath( `${root}/` ).loadAsync( file );
			assert.ok( Object.keys( materials ).length > 0, `${file} should define a material` );

		}

		const { materials } = await new MaterialXLoader().setPath( `${root}/` ).loadAsync( 'standard_surface_opacity_test.mtlx' );
		const material = materials.mat_opacity_test;
		assert.equal( material.constructor.name, 'MeshPhysicalNodeMaterial' );
		assert.equal( material.transparent, true );

	} );

	it( 'KMZLoader loads a Collada model from an archive', async () => {

		const { KMZLoader } = await import( '@kmamal/three/addons/loaders/KMZLoader.js' );
		const kmz = await new KMZLoader().loadAsync( path.join( models, 'kmz/Box.kmz' ) );
		const { meshes } = countMeshes( kmz.scene ?? kmz );
		assert.ok( meshes > 0 );

	} );

} );
