class TextField {

	constructor( text ) {

		this.text = text;
		this.anchor = text.length;
		this.caret = text.length;
		this.scroll = 0;

	}

	get start() {

		return Math.min( this.anchor, this.caret );

	}

	get end() {

		return Math.max( this.anchor, this.caret );

	}

	get hasSelection() {

		return this.anchor !== this.caret;

	}

	get selectedText() {

		return this.text.slice( this.start, this.end );

	}

	selectAll() {

		this.anchor = 0;
		this.caret = this.text.length;

	}

	setCaret( index, extend = false ) {

		this.caret = Math.max( 0, Math.min( this.text.length, index ) );
		if ( extend === false ) this.anchor = this.caret;

	}

	insert( string ) {

		const start = this.start;

		this.text = this.text.slice( 0, start ) + string + this.text.slice( this.end );
		this.caret = this.anchor = start + string.length;

	}

	deleteSelection() {

		if ( this.hasSelection === false ) return false;

		this.insert( '' );
		return true;

	}

	key( event ) {

		const key = event.key;

		if ( event.ctrl === true ) {

			if ( key === 'a' ) {

				this.selectAll();
				return 'moved';

			}

			return null;

		}

		switch ( key ) {

			case 'left':
				if ( this.hasSelection && event.shift !== true ) this.setCaret( this.start );
				else this.setCaret( this.caret - 1, event.shift === true );
				return 'moved';

			case 'right':
				if ( this.hasSelection && event.shift !== true ) this.setCaret( this.end );
				else this.setCaret( this.caret + 1, event.shift === true );
				return 'moved';

			case 'home':
				this.setCaret( 0, event.shift === true );
				return 'moved';

			case 'end':
				this.setCaret( this.text.length, event.shift === true );
				return 'moved';

			case 'backspace':
				if ( this.deleteSelection() === false ) {

					if ( this.caret === 0 ) return null;
					this.anchor = this.caret - 1;
					this.insert( '' );

				}

				return 'changed';

			case 'delete':
				if ( this.deleteSelection() === false ) {

					if ( this.caret === this.text.length ) return null;
					this.anchor = this.caret + 1;
					this.insert( '' );

				}

				return 'changed';

			case 'return':
			case 'enter':
			case 'escape':
			case 'tab':
				return 'commit';

			case 'up':
			case 'down':
				return key;

		}

		return null;

	}

}

export { TextField };
