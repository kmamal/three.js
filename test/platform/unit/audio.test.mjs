import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const examples = path.resolve( import.meta.dirname, '../../../examples' );

let THREE;
let platform;
let audio;

const rms = ( a ) => Math.sqrt( a.reduce( ( s, x ) => s + x * x, 0 ) / a.length );

before( async () => {

	THREE = await import( '@kmamal/three' )
	;( { platform } = await import( '@kmamal/three/src/platform/Platform.js' ) );
	audio = platform.audio;

} );

after( () => {

	THREE.AudioContext.setContext( undefined );

} );

describe( 'audio on the SDL platform', () => {

	it( 'exposes the @kmamal/audio package', () => {

		assert.equal( platform.AudioContext, audio.AudioContext );
		assert.equal( platform.Audio, audio.HTMLAudioElement );
		assert.equal( typeof audio.OfflineAudioContext, 'function' );

	} );

	it( 'decodes the example sounds', async () => {

		const context = new audio.OfflineAudioContext( 1, 128, 44100 );
		for ( const name of [ 'ping_pong.mp3', 'button-press.ogg' ] ) {

			const data = fs.readFileSync( path.join( examples, 'sounds', name ) );
			const buffer = await context.decodeAudioData( data.buffer.slice( data.byteOffset, data.byteOffset + data.length ) );
			assert.equal( buffer.sampleRate, 44100 );
			assert.ok( buffer.duration > 0.05, name );
			assert.ok( rms( buffer.getChannelData( 0 ) ) > 0.001, name );

		}

	} );

	it( 'renders the three.js audio objects through an offline context', async () => {

		const context = new audio.OfflineAudioContext( 2, 44100, 44100 );
		THREE.AudioContext.setContext( context );

		const listener = new THREE.AudioListener();
		const sound = new THREE.PositionalAudio( listener );
		const buffer = await new THREE.AudioLoader().loadAsync( path.join( examples, 'sounds', 'ping_pong.mp3' ) );
		sound.setBuffer( buffer );
		sound.setRefDistance( 1 );
		sound.setLoop( true );
		sound.position.set( - 5, 0, 0 );
		sound.play();
		sound.updateMatrixWorld( true );
		listener.updateMatrixWorld( true );
		assert.equal( sound.isPlaying, true );

		const analyser = new THREE.AudioAnalyser( sound, 32 );

		const rendered = await context.startRendering();
		const left = rms( rendered.getChannelData( 0 ) );
		const right = rms( rendered.getChannelData( 1 ) );
		assert.ok( left > 0.001, `left ${left}` );
		assert.ok( left > right * 1.5, `panned to the left: ${left} vs ${right}` );
		assert.equal( analyser.getFrequencyData().length, 16 );
		assert.ok( analyser.getAverageFrequency() > 0 );
		sound.stop();

	} );

	it( 'plays an audio element through a media element source', async () => {

		const context = new audio.OfflineAudioContext( 1, 22050, 44100 );
		THREE.AudioContext.setContext( context );

		const listener = new THREE.AudioListener();
		const sound = new THREE.Audio( listener );
		const element = new platform.Audio( path.join( examples, 'sounds', 'ping_pong.mp3' ) );
		sound.setMediaElementSource( element );
		await element.play();
		assert.equal( element.paused, false );

		const rendered = await context.startRendering();
		assert.ok( rms( rendered.getChannelData( 0 ) ) > 0.0001 );
		assert.ok( element.currentTime > 0.01 || element.ended );
		element.pause();
		assert.equal( element.paused, true );

	} );

} );
