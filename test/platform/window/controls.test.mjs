import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hasDisplay, createHarness } from './harness.mjs';
import { require } from '../helpers.mjs';

describe( 'stock controls driven by SDL events', { skip: ! hasDisplay && 'needs a display and GPU' }, () => {

	let harness;
	let THREE;

	before( async () => {

		harness = await createHarness( { name: 'WebGLRenderer', webgpu: false, bottomUp: true } );
		THREE = harness.THREE;

	} );
	after( async () => {

		await harness.dispose();

	} );

	const pointer = ( x, y, extra = {} ) => ( { x, y, dx: 0, dy: 0, touch: false, pen: false, ...extra } );

	const drag = ( tick = () => {} ) => {

		const { window } = harness;
		let x = 200;
		let y = 150;
		window.emit( 'mouseMove', pointer( x, y ) );
		window.emit( 'mouseButtonDown', pointer( x, y, { button: 1 } ) );
		for ( let step = 0; step < 10; step ++ ) {

			x += 12;
			y += 5;
			window.emit( 'mouseMove', pointer( x, y, { dx: 12, dy: 5 } ) );
			tick();

		}

		window.emit( 'mouseButtonUp', pointer( x, y, { button: 1 } ) );

	};

	const press = ( key ) => harness.window.emit( 'keyDown', { key, scancode: require( '@kmamal/sdl' ).keyboard.SCANCODE[ key.toUpperCase() ], repeat: false, shift: false, ctrl: false, alt: false, super: false } );

	const makeCamera = () => {

		const camera = new THREE.PerspectiveCamera( 60, 4 / 3, 0.1, 100 );
		camera.position.set( 0, 3, 4 );
		camera.lookAt( 0, 0, 0 );
		camera.updateMatrixWorld( true );
		return camera;

	};

	const moved = ( camera, before ) => camera.position.distanceTo( before.position ) > 1e-6 || camera.quaternion.angleTo( before.quaternion ) > 1e-6;

	const snapshot = ( camera ) => ( { position: camera.position.clone(), quaternion: camera.quaternion.clone() } );

	const dragControls = [
		[ 'OrbitControls', 'OrbitControls.js', ( C, camera, element ) => new C( camera, element ) ],
		[ 'MapControls', 'MapControls.js', ( C, camera, element ) => new C( camera, element ) ],
		[ 'TrackballControls', 'TrackballControls.js', ( C, camera, element ) => {

			const controls = new C( camera, element ); controls.handleResize(); return controls;

		} ],
		[ 'ArcballControls', 'ArcballControls.js', ( C, camera, element ) => new C( camera, element, new THREE.Scene() ) ],
	];

	for ( const [ name, file, create ] of dragControls ) {

		it( `${name} rotates the camera on a mouse drag`, async () => {

			const module = await import( `@kmamal/three/addons/controls/${file}` );
			const camera = makeCamera();
			const controls = create( module[ name ], camera, harness.renderer.domElement );
			const before = snapshot( camera );
			drag( () => controls.update?.() );
			assert.ok( moved( camera, before ), `${name} did not move the camera` );
			controls.dispose();

		} );

	}

	it( 'OrbitControls zooms with the wheel', async () => {

		const { OrbitControls } = await import( '@kmamal/three/addons/controls/OrbitControls.js' );
		const camera = makeCamera();
		const controls = new OrbitControls( camera, harness.renderer.domElement );
		const before = camera.position.length();
		for ( let notch = 0; notch < 3; notch ++ ) harness.window.emit( 'mouseWheel', pointer( 200, 150, { dy: 1, flipped: false } ) );
		controls.update();
		assert.ok( Math.abs( camera.position.length() - before * Math.pow( 0.95, 3 ) ) < 1e-6, `distance ${camera.position.length()}` );
		controls.dispose();

	} );

	for ( const [ name, file ] of [[ 'FlyControls', 'FlyControls.js' ], [ 'FirstPersonControls', 'FirstPersonControls.js' ]] ) {

		it( `${name} moves the camera with the keyboard`, async () => {

			const module = await import( `@kmamal/three/addons/controls/${file}` );
			const camera = makeCamera();
			const controls = new module[ name ]( camera, harness.renderer.domElement );
			controls.movementSpeed = 10;
			const before = snapshot( camera );
			press( 'w' );
			controls.update( 0.1 );
			assert.ok( moved( camera, before ), `${name} did not move the camera` );
			controls.dispose();

		} );

	}

	describe( 'TransformControls', () => {

		const setup = async () => {

			const { TransformControls } = await import( '@kmamal/three/addons/controls/TransformControls.js' );
			const { window, renderer } = harness;
			const camera = makeCamera();
			camera.aspect = window.width / window.height;
			camera.updateProjectionMatrix();
			camera.updateMatrixWorld( true );
			const scene = new THREE.Scene();
			const mesh = new THREE.Mesh( new THREE.BoxGeometry(), new THREE.MeshBasicMaterial() );
			scene.add( mesh );
			const controls = new TransformControls( camera, renderer.domElement );
			scene.add( controls.getHelper() );
			controls.attach( mesh );
			scene.updateMatrixWorld( true );
			const toScreen = ( point ) => {

				const projected = point.clone().project( camera );
				return { x: ( projected.x + 1 ) / 2 * window.width, y: ( 1 - projected.y ) / 2 * window.height };

			};

			return { controls, camera, scene, mesh, toScreen };

		};

		const findHandle = ( controls, from, axis ) => {

			for ( let offset = 4; offset < harness.window.width - from.x; offset += 2 ) {

				const x = from.x + offset;
				harness.window.emit( 'mouseMove', pointer( x, from.y, { dx: 2 } ) );
				if ( controls.axis === axis ) return { x, y: from.y };

			}

			return null;

		};

		const dragFrom = ( handle, deltaX, controls ) => {

			const { window } = harness;
			window.emit( 'mouseButtonDown', pointer( handle.x, handle.y, { button: 1 } ) );
			const states = [ controls.dragging ];
			for ( let step = 1; step <= 10; step ++ ) window.emit( 'mouseMove', pointer( handle.x + deltaX * step / 10, handle.y, { dx: deltaX / 10 } ) );
			window.emit( 'mouseButtonUp', pointer( handle.x + deltaX, handle.y, { button: 1 } ) );
			states.push( controls.dragging );
			return states;

		};

		it( 'attaches to an object and exposes the gizmo', async () => {

			const { controls, mesh } = await setup();
			assert.equal( controls.object, mesh );
			assert.equal( controls.getHelper().isObject3D, true );
			controls.dispose();

		} );

		it( 'finds the X axis handle by hovering over it', async () => {

			const { controls, mesh, toScreen } = await setup();
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle, 'hovering to the right of the object should pick the X axis handle' );
			harness.window.emit( 'mouseMove', pointer( 2, 2 ) );
			assert.equal( controls.axis, null );
			controls.dispose();

		} );

		it( 'translates the object along the picked axis only', async () => {

			const { controls, mesh, toScreen } = await setup();
			const events = { dragging: [], change: 0 };
			controls.addEventListener( 'dragging-changed', ( event ) => events.dragging.push( event.value ) );
			controls.addEventListener( 'objectChange', () => {

				events.change ++;

			} );
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle );
			const [ duringDown ] = dragFrom( handle, 40, controls );
			assert.equal( duringDown, true, 'pressing on the handle starts a drag' );
			assert.equal( controls.dragging, false, 'releasing ends the drag' );
			assert.ok( mesh.position.x > 0.05, `x should increase, got ${mesh.position.x}` );
			assert.ok( Math.abs( mesh.position.y ) < 1e-6 && Math.abs( mesh.position.z ) < 1e-6, `y and z must stay put, got ${mesh.position.toArray()}` );
			assert.deepEqual( events.dragging, [ true, false ] );
			assert.ok( events.change > 0 );
			controls.dispose();

		} );

		it( 'moves the object back when dragged the other way', async () => {

			const { controls, mesh, scene, toScreen } = await setup();
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle );
			dragFrom( handle, 40, controls );
			const forward = mesh.position.x;
			scene.updateMatrixWorld( true );
			const next = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( next, 'the handle follows the object' );
			dragFrom( next, - 40, controls );
			assert.ok( mesh.position.x < forward, `expected to move back from ${forward}, got ${mesh.position.x}` );
			controls.dispose();

		} );

		it( 'scales the object along the picked axis in scale mode', async () => {

			const { controls, mesh, toScreen } = await setup();
			controls.setMode( 'scale' );
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle );
			dragFrom( handle, 40, controls );
			assert.ok( mesh.scale.x > 1.05, `scale.x should grow, got ${mesh.scale.x}` );
			assert.ok( Math.abs( mesh.scale.y - 1 ) < 1e-6 && Math.abs( mesh.scale.z - 1 ) < 1e-6 );
			controls.dispose();

		} );

		it( 'rotates the object around the picked ring in rotate mode', async () => {

			const { controls, mesh, toScreen } = await setup();
			controls.setMode( 'rotate' );
			const center = toScreen( mesh.position );
			let handle = null;
			for ( let offset = 4; offset < harness.window.height / 2 && handle === null; offset += 2 ) {

				for ( const sign of [ - 1, 1 ] ) {

					const y = center.y + sign * offset;
					harness.window.emit( 'mouseMove', pointer( center.x, y, { dy: 2 } ) );
					if ( controls.axis === 'X' ) {

						handle = { x: center.x, y }; break;

					}

				}

			}

			assert.ok( handle, 'a vertical scan through the object should hit the X rotation ring' );
			const { window } = harness;
			window.emit( 'mouseButtonDown', pointer( handle.x, handle.y, { button: 1 } ) );
			assert.equal( controls.dragging, true );
			for ( let step = 1; step <= 10; step ++ ) window.emit( 'mouseMove', pointer( handle.x, handle.y + 4 * step, { dy: 4 } ) );
			window.emit( 'mouseButtonUp', pointer( handle.x, handle.y + 40, { button: 1 } ) );
			assert.ok( Math.abs( mesh.rotation.x ) > 0.05, `rotation.x should change, got ${mesh.rotation.x}` );
			assert.ok( Math.abs( mesh.rotation.y ) < 1e-6 && Math.abs( mesh.rotation.z ) < 1e-6, `only x may rotate, got ${mesh.rotation.toArray()}` );
			controls.dispose();

		} );

		it( 'snaps translation to the configured step', async () => {

			const { controls, mesh, toScreen } = await setup();
			controls.setTranslationSnap( 0.5 );
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle );
			dragFrom( handle, 40, controls );
			assert.ok( Math.abs( mesh.position.x / 0.5 - Math.round( mesh.position.x / 0.5 ) ) < 1e-6, `x=${mesh.position.x} should be a multiple of 0.5` );
			controls.dispose();

		} );

		it( 'does nothing while disabled', async () => {

			const { controls, mesh, toScreen } = await setup();
			const handle = findHandle( controls, toScreen( mesh.position ), 'X' );
			assert.ok( handle );
			controls.enabled = false;
			dragFrom( handle, 40, controls );
			assert.equal( mesh.position.x, 0 );
			controls.dispose();

		} );

	} );

} );
