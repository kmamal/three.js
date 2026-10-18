import { setStatus } from '../utils/SDLWindow.js';

class Stats {

	constructor() {

		const noop = () => {};

		this.REVISION = 16;

		this.dom = {
			style: {},
			children: [],
			addEventListener: noop,
			removeEventListener: noop,
			appendChild: noop,
			remove: noop
		};

		this.domElement = this.dom;

		this._now = () => performance.now();
		this._beginTime = this._now();
		this._prevTime = this._beginTime;
		this._frames = 0;
		this._ms = 0;

	}

	addPanel( panel ) {

		return panel;

	}

	showPanel() {}

	setMode() {}

	begin() {

		this._beginTime = this._now();

	}

	end() {

		this._frames ++;

		const time = this._now();

		this._ms = time - this._beginTime;

		if ( time >= this._prevTime + 1000 ) {

			const fps = Math.round( this._frames * 1000 / ( time - this._prevTime ) );

			setStatus( `${ fps } fps, ${ Math.round( this._ms ) } ms` );

			this._prevTime = time;
			this._frames = 0;

		}

		return time;

	}

	update() {

		this._beginTime = this.end();

	}

}

export default Stats;
