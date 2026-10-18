import * as THREE from '@kmamal/three/webgpu';
import { If, vec4, uv, ivec2, texture, Fn } from '@kmamal/three/tsl';
import { createWindow, viewOf } from '@kmamal/three/addons/utils/SDLWindow.js';

const sdlWindows = {
	webgpu: createWindow( { title: 'three.js webgpu - texture gather - webgpu', api: 'webgpu' } ),
	webgl: createWindow( { title: 'three.js webgpu - texture gather - webgl', api: 'webgl' } )
};

// WebGPU Backend
init();

// WebGL Backend
init( true );

async function init( forceWebGL = false ) {

	const sdlWindow = sdlWindows[ forceWebGL ? 'webgl' : 'webgpu' ];
	const view = viewOf( sdlWindow ).window;

	const aspect = view.innerWidth / view.innerHeight;
	const camera = new THREE.OrthographicCamera( - aspect, aspect );
	camera.position.z = 2;

	const scene = new THREE.Scene();

	// texture

	const material = new THREE.MeshBasicNodeMaterial( { color: 0xffffff } );

	const colorNode = texture();
	const depthNode = texture();

	material.colorNode = Fn( () => {

		const color = vec4( 1 ).toVar();

		const vuv = uv().toVar();

		If( vuv.y.greaterThan( 0.5 ), () => {

			color.assign(
				colorNode.sample( vuv.mul( 10 ) ).offset( ivec2( 0, 7 ) ).gather( 0 )
			);

		} ).Else( () => {

			color.assign(
				depthNode.sample( vuv ).offset( ivec2( 0, 7 ) ).gather( 0 ).compare( 1 )
			);

		} );

		return color;

	} )();

	//

	const plane = new THREE.Mesh( new THREE.PlaneGeometry( 1, 1 ), material );
	scene.add( plane );

	const renderer = new THREE.WebGPURenderer( { antialias: false, forceWebGL: forceWebGL, window: sdlWindow } );
	renderer.setPixelRatio( view.devicePixelRatio );
	renderer.setSize( view.innerWidth, view.innerHeight );
	renderer.setAnimationLoop( animate );
	await renderer.init();

	if ( forceWebGL ) {

		scene.background = new THREE.Color( 0x212121 );

	} else {

		scene.background = new THREE.Color( 0x313131 );

	}

	//

	const depthTexture = new THREE.DepthTexture();
	depthTexture.compareFunction = THREE.LessEqualCompare;
	const rt = new THREE.RenderTarget( 100, 100, {
		depthTexture,
		generateMipmaps: true,
		minFilter: THREE.LinearMipmapLinearFilter
	} );
	rt.texture.wrapS = THREE.RepeatWrapping;
	rt.texture.wrapT = THREE.RepeatWrapping;

	const cameraZ = 2.5;
	const rtScene = new THREE.Scene();
	rtScene.background = new THREE.Color( 0x808080 );
	const rtCamera = new THREE.PerspectiveCamera( 50, 1, cameraZ - 0.5 * Math.sqrt( 3 ), cameraZ + 0.5 * Math.sqrt( 3 ) );
	rtCamera.position.z = cameraZ;

	const dirLight = new THREE.DirectionalLight();
	dirLight.position.set( 1, 1, 0 );
	rtScene.add( dirLight );
	rtScene.add( new THREE.AmbientLight( 0xffffff, 0.1 ) );

	const box = new THREE.Mesh(
		new THREE.BoxGeometry(),
		new THREE.MeshStandardNodeMaterial( { color: 0xff0000 } )
	);
	box.rotation.set( Math.PI / 4, Math.PI / 4, 0 );
	rtScene.add( box );

	renderer.setRenderTarget( rt );
	renderer.render( rtScene, rtCamera );
	renderer.setRenderTarget( null );

	colorNode.value = rt.texture;
	depthNode.value = rt.depthTexture;

	//

	function animate() {

		renderer.render( scene, camera );

	}

	view.addEventListener( 'resize', onWindowResize );

	function onWindowResize() {

		renderer.setSize( view.innerWidth, view.innerHeight );

		const aspect = view.innerWidth / view.innerHeight;

		const frustumHeight = camera.top - camera.bottom;

		camera.left = - frustumHeight * aspect / 2;
		camera.right = frustumHeight * aspect / 2;

		camera.updateProjectionMatrix();

		renderer.render( scene, camera );

	}

}
