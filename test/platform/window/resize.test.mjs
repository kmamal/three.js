import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, hasDisplay, createHarness } from './harness.mjs';

const resizeTo = ( window, width, height, timeout = 3000 ) => new Promise( ( resolve ) => {

	const timer = setTimeout( () => {

		window.off( 'resize', onResize ); resolve( false );

	}, timeout );
	const onResize = () => {

		if ( window.width !== width || window.height !== height ) return;
		clearTimeout( timer );
		window.off( 'resize', onResize );
		resolve( true );

	};

	window.on( 'resize', onResize );
	window.setSize( width, height );

} );

for ( const kind of KINDS ) {

	describe( `${kind.name} resizing`, { skip: ! hasDisplay && 'needs a display and GPU' }, () => {

		let harness;
		let scene;
		let camera;

		before( async () => {

			harness = await createHarness( kind );
			const { THREE } = harness;
			scene = new THREE.Scene();
			scene.add( new THREE.Mesh( new THREE.BoxGeometry(), new THREE.MeshBasicMaterial( { color: 0xff8030 } ) ) );
			camera = new THREE.PerspectiveCamera( 60, 1, 0.1, 100 );
			camera.position.z = 3;

		} );
		after( async () => {

			await harness.dispose();

		} );

		const applyResize = () => {

			const { renderer, window } = harness;
			renderer.setSize( window.pixelWidth, window.pixelHeight, false );
			camera.aspect = window.pixelWidth / window.pixelHeight;
			camera.updateProjectionMatrix();

		};

		const drawingBufferSize = () => {

			const { renderer } = harness;
			if ( kind.name === 'WebGLRenderer' || kind.forceWebGL ) {

				const gl = renderer.getContext();
				return [ gl.drawingBufferWidth, gl.drawingBufferHeight ];

			}

			const texture = renderer.backend.context.getCurrentTexture();
			return [ texture.width, texture.height ];

		};

		it( 'follows the window size after setSize', async ( t ) => {

			const { renderer, window } = harness;
			if ( ! await resizeTo( window, 400, 300 ) ) return t.skip( 'the window manager did not resize the window (tiling? make it floating)' );
			applyResize();
			renderer.render( scene, camera );
			assert.equal( renderer.domElement.width, window.pixelWidth );
			assert.equal( renderer.domElement.height, window.pixelHeight );
			assert.deepEqual( drawingBufferSize(), [ window.pixelWidth, window.pixelHeight ] );

		} );

		it( 'recovers a swapchain that went out of sync with the canvas', async ( t ) => {

			if ( kind.name === 'WebGLRenderer' || kind.forceWebGL ) return t.skip( 'only the WebGPU surface can go out of sync' );
			const { renderer, window } = harness;
			if ( ! await resizeTo( window, 440, 330 ) ) return t.skip( 'the window manager did not resize the window (tiling? make it floating)' );
			applyResize();
			renderer.render( scene, camera );
			if ( ! await resizeTo( window, 300, 200 ) ) return t.skip( 'the window manager did not resize the window (tiling? make it floating)' );
			renderer.domElement._gpuRenderer.resize();
			assert.deepEqual( drawingBufferSize(), [ window.pixelWidth, window.pixelHeight ] );
			if ( ! await resizeTo( window, 440, 330 ) ) return t.skip( 'the window manager did not resize the window (tiling? make it floating)' );
			renderer.setSize( window.pixelWidth, window.pixelHeight, false );
			renderer.render( scene, camera );
			assert.deepEqual( drawingBufferSize(), [ 440, 330 ] );

		} );

		it( 'survives repeated growing and shrinking', async ( t ) => {

			const { renderer, window } = harness;
			const sizes = [[ 640, 360 ], [ 300, 200 ], [ 500, 500 ], [ 220, 160 ], [ 480, 270 ], [ 350, 350 ]];
			let applied = 0;
			for ( const [ width, height ] of sizes ) {

				if ( ! await resizeTo( window, width, height ) ) return t.skip( 'the window manager did not resize the window (tiling? make it floating)' );
				applyResize();
				renderer.render( scene, camera );
				assert.deepEqual( drawingBufferSize(), [ window.pixelWidth, window.pixelHeight ], `after resizing to ${width}x${height}` );
				applied ++;

			}

			assert.equal( applied, sizes.length );

		} );

	} );

}
