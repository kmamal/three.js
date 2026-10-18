import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasDisplay, createHarness } from './harness.mjs';

describe( 'WebGLRenderer in a window', { skip: ! hasDisplay && 'needs a display and GPU' }, () => {

	let harness;

	before( async () => {

		harness = await createHarness( { name: 'WebGLRenderer', webgpu: false, bottomUp: true } );

	} );
	after( async () => {

		await harness.dispose();

	} );

	it( 'sizes the canvas to the window in pixels', () => {

		const { renderer, window } = harness;
		assert.equal( renderer.domElement.width, window.pixelWidth );
		assert.equal( renderer.domElement.height, window.pixelHeight );
		assert.equal( renderer.domElement.clientWidth, window.width );

	} );

	it( 'exposes a WebGL2 context bound to the canvas', () => {

		const gl = harness.renderer.getContext();
		assert.equal( gl.canvas, harness.renderer.domElement );
		assert.equal( typeof gl.createVertexArray, 'function' );

	} );

	it( 'exposes the document and view surface the controls rely on', () => {

		const { domElement } = harness.renderer;
		assert.equal( domElement.getRootNode(), domElement.ownerDocument );
		assert.equal( domElement.ownerDocument.hidden, false );
		assert.equal( domElement.ownerDocument.defaultView.innerWidth, harness.window.width );
		assert.equal( typeof domElement.getBoundingClientRect().width, 'number' );

	} );

	it( 'delivers context loss and restoration events asynchronously', async () => {

		const { renderer } = harness;
		const events = [];
		for ( const type of [ 'webglcontextlost', 'webglcontextrestored' ] ) renderer.domElement.addEventListener( type, () => {

			events.push( type );

		} );
		const extension = renderer.getContext().getExtension( 'WEBGL_lose_context' );
		extension.loseContext();
		assert.equal( renderer.getContext().isContextLost(), true );
		assert.deepEqual( events, [] );
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		extension.restoreContext();
		await new Promise( ( resolve ) => setImmediate( resolve ) );
		assert.deepEqual( events, [ 'webglcontextlost', 'webglcontextrestored' ] );
		assert.equal( renderer.getContext().isContextLost(), false );

	} );

} );
