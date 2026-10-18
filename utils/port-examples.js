import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve( import.meta.dirname, '..' );
const examples = path.join( root, 'examples' );
const patches = path.join( import.meta.dirname, 'port-examples/patches' );

const UNSUPPORTED_PREFIXES = /^(webxr|css2d|css3d)_/;
const UNSUPPORTED_CODE = /<video\b|VideoTexture|getUserMedia|XRButton|VRButton|ARButton|\.xr\./;

const GUI_SPECIFIER = '@kmamal/three/addons/libs/lil-gui.module.js';
const AMMO_SPECIFIER = '@kmamal/three/addons/libs/ammo.global.js';

const PACKAGES = {
	'3d-tiles-renderer': '3d-tiles-renderer',
	'@gsimone/three-raycaster-helper': '@gsimone/three-raycaster-helper',
	'@jgphilpott/polyslice': '@jgphilpott/polyslice',
	'@needle-tools/gltf-progressive': '../node_modules/@needle-tools/gltf-progressive/gltf-progressive.min.js',
	'@needle-tools/three-animation-pointer': '@needle-tools/three-animation-pointer',
	'@perplexdotgg/bounce': '@perplexdotgg/bounce',
	'@takram/three-atmosphere': '@takram/three-atmosphere',
	'@takram/three-clouds': '@takram/three-clouds',
	'@takram/three-geospatial': '@takram/three-geospatial',
	'@takram/three-geospatial-effects': '@takram/three-geospatial-effects',
	'@three.ez/batched-mesh-extensions': '@three.ez/batched-mesh-extensions',
	'@three.ez/simplify-geometry': '@three.ez/simplify-geometry',
	'bvh.js': 'bvh.js',
	'lottie-web': 'lottie-web',
	'meshoptimizer': 'meshoptimizer',
	'monomorph': 'monomorph',
	'postprocessing': 'postprocessing',
	'three-bvh-csg': 'three-bvh-csg',
	'three-good-godrays': 'three-good-godrays',
	'three-gpu-pathtracer': 'three-gpu-pathtracer',
	'three-html-render': 'three-html-render',
	'three-mesh-bvh': 'three-mesh-bvh',
	'three-subdivide': 'three-subdivide',
	'web-ifc': 'web-ifc',
};

const DOM_CHECKS = [
	[ 'getElementById/querySelector', /\b(?:getElementById|querySelector(?:All)?)\b/ ],
	[ 'document.*', /\bdocument\.(?!addEventListener|removeEventListener|createElement\( ?'(?:canvas|img)' ?\)|body\.(?:style|addEventListener|removeEventListener))\w+/ ],
	[ 'navigator', /\bnavigator\b/ ],
	[ 'location/history', /\b(?:location|history)\./ ],
	[ 'localStorage', /\blocalStorage\b/ ],
	[ 'HTML elements', /\bHTML\w*Element\b|\.innerHTML\b|\.textContent\b|\.classList\b|\.style\.(?!touchAction|cursor)/ ],
	[ 'Blob/File/URL', /\b(?:Blob|FileReader|File)\b|URL\.(?:createObjectURL|revokeObjectURL)/ ],
	[ 'window.*', /\bwindow\.(?!innerWidth|innerHeight|devicePixelRatio|addEventListener|removeEventListener|requestAnimationFrame|cancelAnimationFrame)\w+/ ],
	[ 'alert/prompt', /\b(?:alert|prompt|confirm)\(/ ],
	[ 'createElement', /\bcreateElement\( ?'(?!canvas|img)/ ],
	[ 'appendChild', /\bappendChild\b/ ],
	[ 'WebSocket/Worker', /\bnew (?:WebSocket|Worker)\b/ ],
	[ 'fetch of absolute path', /fetch\( ?['"`]\// ],
];

const dependencies = ( () => {

	const json = JSON.parse( fs.readFileSync( path.join( root, 'package.json' ), 'utf8' ) );

	return new Set( [ 'dependencies', 'devDependencies', 'peerDependencies' ].flatMap( ( key ) => Object.keys( json[ key ] || {} ) ) );

} )();

function findClosing( code, open ) {

	const pairs = { '(': ')', '[': ']', '{': '}' };
	const stack = [];

	for ( let i = open; i < code.length; i ++ ) {

		const c = code[ i ];

		if ( c === '\'' || c === '"' || c === '`' ) {

			for ( i ++; i < code.length && code[ i ] !== c; i ++ ) if ( code[ i ] === '\\' ) i ++;
			continue;

		}

		if ( c === '/' && code[ i + 1 ] === '/' ) {

			while ( i < code.length && code[ i ] !== '\n' ) i ++;
			continue;

		}

		if ( c === '/' && code[ i + 1 ] === '*' ) {

			i = code.indexOf( '*/', i + 2 ) + 1;
			continue;

		}

		if ( pairs[ c ] ) stack.push( pairs[ c ] );
		else if ( c === ')' || c === ']' || c === '}' ) {

			stack.pop();
			if ( stack.length === 0 ) return i;

		}

	}

	return - 1;

}

function escapeRegExp( text ) {

	return text.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );

}

function mapCode( code, transform ) {

	let result = '';
	let start = 0;
	let i = 0;

	while ( i < code.length ) {

		const c = code[ i ];
		let end = - 1;

		if ( c === '/' && code[ i + 1 ] === '/' ) {

			end = code.indexOf( '\n', i );
			if ( end === - 1 ) end = code.length;

		} else if ( c === '/' && code[ i + 1 ] === '*' ) {

			end = code.indexOf( '*/', i + 2 );
			end = end === - 1 ? code.length : end + 2;

		} else if ( c === '\'' || c === '"' ) {

			let j = i + 1;
			while ( j < code.length && code[ j ] !== c && code[ j ] !== '\n' ) j += code[ j ] === '\\' ? 2 : 1;
			end = Math.min( j + 1, code.length );

		}

		if ( end === - 1 ) {

			i ++;
			continue;

		}

		result += transform( code.slice( start, i ) ) + code.slice( i, end );
		start = i = end;

	}

	return result + transform( code.slice( start ) );

}

function indentWidth( whitespace ) {

	let width = 0;

	for ( const c of whitespace ) width = c === '\t' ? width + 4 - ( width % 4 ) : width + 1;

	return width;

}

function dedent( code ) {

	const lines = code.split( '\n' );
	const first = lines.find( ( line ) => line.trim() !== '' );

	if ( first === undefined ) return code;

	const prefix = '\t'.repeat( /^\t*/.exec( first )[ 0 ].length );

	if ( prefix === '' ) return code;

	return lines.map( ( line ) => {

		if ( line.startsWith( prefix ) ) return line.slice( prefix.length );

		const whitespace = /^[\t ]*/.exec( line )[ 0 ];
		const width = indentWidth( whitespace ) - prefix.length * 4;

		if ( line.trim() === '' || width < 0 ) return line;

		return '\t'.repeat( Math.floor( width / 4 ) ) + ' '.repeat( width % 4 ) + line.slice( whitespace.length );

	} ).join( '\n' );

}

function escapeTemplate( text ) {

	return text.replace( /\\/g, '\\\\' ).replace( /`/g, '\\`' ).replace( /\$\{/g, '\\${' );

}

function quote( text ) {

	return '\'' + text.replace( /\\/g, '\\\\' ).replace( /'/g, '\\\'' ) + '\'';

}

function parseHtml( html ) {

	const title = ( /<title>(.*?)<\/title>/s.exec( html )?.[ 1 ] ?? '' ).trim();
	const scripts = [];

	for ( const match of html.matchAll( /<script\b([^>]*)>(.*?)<\/script>/gs ) ) {

		scripts.push( { attributes: match[ 1 ], text: match[ 2 ] } );

	}

	return { title, scripts };

}

function removeLines( code, patterns ) {

	const lines = code.split( '\n' );
	const kept = [];

	for ( let i = 0; i < lines.length; i ++ ) {

		if ( patterns.some( ( pattern ) => pattern.test( lines[ i ] ) ) ) {

			if ( lines[ i + 1 ] !== undefined && lines[ i + 1 ].trim() === '' && ( kept.length === 0 || kept[ kept.length - 1 ].trim() === '' ) ) i ++;
			continue;

		}

		kept.push( lines[ i ] );

	}

	return kept.join( '\n' );

}

function countReferences( code, name ) {

	return ( code.match( new RegExp( `(?<![\\w$.])${escapeRegExp( name )}(?![\\w$])`, 'g' ) ) || [] ).length;

}

function removeFromDeclarationList( code, name ) {

	return code.replace( /^([\t ]*(?:let|var) )([^;\n]*);/gm, ( all, head, list ) => {

		const items = list.split( ',' ).map( ( n ) => n.trim() );

		if ( ! items.includes( name ) ) return all;

		const kept = items.filter( ( n ) => n !== name );

		return kept.length === 0 ? '' : `${head}${kept.join( ', ' )};`;

	} );

}

function pruneUnusedVariable( code, name ) {

	const declaration = new RegExp( `^[\\t ]*(?:const |let |var )?${name} = document\\.(?:createElement|getElementById|querySelector)\\([^;]*;[^\\n]*\\n(?:[\\t ]*\\n)?`, 'm' );

	if ( ! declaration.test( code ) ) return code;

	const without = code.replace( declaration, '' );

	if ( countReferences( without, name ) > 1 ) return code;

	let result = without;

	if ( countReferences( result, name ) === 1 ) {

		result = result.replace( new RegExp( '^([\\t ]*(?:let|var) )([^;\\n]*);', 'm' ), ( all, head, list ) => {

			if ( ! new RegExp( `(?<![\\w$.])${name}(?![\\w$])` ).test( list ) ) return all;

			const names = list.split( ',' ).map( ( n ) => n.trim() ).filter( ( n ) => n !== name );

			return names.length === 0 ? '' : `${head}${names.join( ', ' )};`;

		} );

		if ( countReferences( result, name ) > 0 ) return code;

	}

	return result.replace( /\n{3,}/g, '\n\n' );

}

function findRenderer( code ) {

	const match = /(?:const |let )?(\w+)\s*=\s*new (?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\(/.exec( code );

	return match ? match[ 1 ] : 'renderer';

}

function packageOf( url ) {

	const match = /^https:\/\/cdn\.jsdelivr\.net\/npm\/((?:@[^/@]+\/)?[^/@]+)/.exec( url );

	return match ? match[ 1 ] : null;

}

function resolveSpecifier( specifier, imports ) {

	let key = null;
	let target = null;

	if ( Object.hasOwn( imports, specifier ) ) {

		key = specifier;
		target = imports[ specifier ];

	} else {

		for ( const candidate of Object.keys( imports ) ) {

			if ( candidate.endsWith( '/' ) && specifier.startsWith( candidate ) && ( key === null || candidate.length > key.length ) ) key = candidate;

		}

		if ( key !== null ) target = imports[ key ] + specifier.slice( key.length );

	}

	if ( specifier === 'three' || specifier.startsWith( 'three/' ) ) {

		if ( specifier === 'three' && target !== null && /three\.webgpu\.js$/.test( target ) ) return '@kmamal/three/webgpu';

		return '@kmamal/' + specifier.replace( /^three\/addons\/libs\/lil-gui\.module\.min\.js$/, 'three/addons/libs/lil-gui.module.js' );

	}

	if ( target === null ) target = specifier;

	const local = /^(?:\.\/|\.\.\/examples\/)jsm\/(.*)$/.exec( target );

	if ( local !== null && key !== null ) return '@kmamal/three/addons/' + local[ 1 ];

	const name = packageOf( target );

	if ( name === null || ! Object.hasOwn( PACKAGES, name ) ) return specifier;

	if ( specifier === name || specifier.startsWith( name + '/' ) ) return PACKAGES[ name ] + specifier.slice( name.length );

	return PACKAGES[ name ];

}

function resolveImports( code, importMap ) {

	let imports = {};

	if ( importMap !== undefined ) {

		try {

			imports = JSON.parse( importMap.text ).imports || {};

		} catch {

			imports = {};

		}

	}

	return code.replace( /(\bfrom\s*|\bimport\s*\(\s*|^[\t ]*import\s*)(['"])([^'"\n]+)\2/gm, ( all, head, mark, specifier ) => head + mark + resolveSpecifier( specifier, imports ) + mark );

}

function removeChainedCall( code, name ) {

	const pattern = new RegExp( `\\s*\\.${name}\\(`, 'g' );
	let result = '';
	let last = 0;
	let match;

	while ( ( match = pattern.exec( code ) ) !== null ) {

		const close = findClosing( code, match.index + match[ 0 ].length - 1 );

		result += code.slice( last, match.index ) + '\uE000';
		last = close + 1;
		pattern.lastIndex = last;

	}

	return result + code.slice( last );

}

function inspectorToGUI( code ) {

	if ( ! /\bInspector\b|\.inspector\b|\.toInspector\(/.test( code ) ) return code;

	const needsGUI = /\.inspector\.createParameters\(/.test( code ) && ! /\bimport\s*\{\s*GUI\s*\}/.test( code );

	code = code.replace( /^([\t ]*)import \{ Inspector \} from '[^']*';[\t ]*\n(?:[\t ]*\n)?/m, ( all, indent ) => needsGUI ? `${indent}import { GUI } from '${GUI_SPECIFIER}';\n` : '' );

	code = code.replace( /^[\t ]*[\w.]+\.inspector = new Inspector\(\);[\t ]*\n(?:[\t ]*\n)?/gm, '' );

	code = removeLines( code, [
		/^\s*\/\/ [Ii]nspector\b[^\n]*$/,
		/^\s*document\.body\.appendChild\( [\w.]+\.inspector\.domElement \);\s*$/,
	] );

	code = code.replace( /\b[\w.]+\.inspector\.createParameters\( ('[^']*') \)/g, 'new GUI( { title: $1 } )' );

	const before = code;

	code = removeChainedCall( code, 'toInspector' );
	code = removeLines( code, [ /^\s*[\w$.]+\uE000;\s*$/ ] ).replace( /\uE000/g, '' );

	code = code.replace( /^([\t ]*import\s*\{)([^}]*)(\}\s*from\s*'[^']*';)/gm, ( all, head, list, tail ) => {

		const names = list.split( ',' ).map( ( n ) => n.trim() ).filter( ( n ) => n !== '' );
		const kept = names.filter( ( n ) => countReferences( before, n ) === 1 || countReferences( code, n ) > 1 );

		return kept.length === names.length ? all : `${head} ${kept.join( ', ' )} ${tail}`;

	} );

	code = code.replace( /\.debounce\( \d+ \)\.onChange\(/g, '.onFinishChange(' );

	const debounce = /\.debounce\( \d+ \)/g;
	let match;

	while ( ( match = debounce.exec( code ) ) !== null ) {

		const end = match.index;
		const start = code.lastIndexOf( '.onChange(', end );

		if ( start !== - 1 && findClosing( code, start + 9 ) === end - 1 ) {

			code = code.slice( 0, start ) + '.onFinishChange(' + code.slice( start + 10, end ) + code.slice( end + match[ 0 ].length );

		} else {

			code = code.slice( 0, end ) + code.slice( end + match[ 0 ].length );

		}

		debounce.lastIndex = 0;

	}

	const listener = /\)\.addEventListener\( 'change', \( (\w+) \) => \{/g;

	while ( ( match = listener.exec( code ) ) !== null ) {

		const open = match.index + match[ 0 ].length - 1;
		const close = findClosing( code, open );
		const original = code.slice( open, close + 1 );
		const replaced = original.replace( new RegExp( `(?<![\\w$.])${match[ 1 ]}\\.value(?![\\w$])`, 'g' ), 'value' );
		const renamed = countReferences( replaced, match[ 1 ] ) === 0;

		code = code.slice( 0, match.index ) + `).onChange( ( ${renamed ? 'value' : match[ 1 ]} ) => ` + ( renamed ? replaced : original ) + code.slice( close + 1 );
		listener.lastIndex = 0;

	}

	code = code.replace( /(\))\.addEventListener\( 'change', /g, '$1.onChange( ' );
	code = code.replace( /\.addString\(/g, '.add(' );
	code = code.replace( /\b(\w+)\.paramList\.domElement\.style\.display = 'none';/g, '$1.close();' );
	code = code.replace( /\b(\w+)\.paramList\.domElement\.style\.display = '';/g, '$1.open();' );
	code = code.replace( /\b(\w+)\.input\.disabled = true;/g, '$1.disable();' );

	return code;

}

function removeStartButton( code ) {

	code = code.replace( /^[\t ]*const overlay = document\.getElementById\( 'overlay' \);\n[\t ]*overlay\.remove\(\);\n(?:[\t ]*\n(?:[\t ]*\/\/\n[\t ]*\n)?)?/gm, '' );

	const pattern = /^([\t ]*)(?:const |let )?(\w+) = document\.(?:getElementById\( 'startButton' \)|querySelector\( '#startButton' \));\n[\t ]*\2\.addEventListener\( 'click', /m;
	const match = pattern.exec( code );

	if ( match === null ) return code;

	const open = match.index + match[ 0 ].lastIndexOf( '(' );
	const close = findClosing( code, open );
	const handler = code.slice( match.index + match[ 0 ].length, close ).trim();
	let call = null;

	if ( /^[\w$]+$/.test( handler ) ) {

		call = `${handler}();`;

	} else {

		const body = /^(?:function \(\)|\(\) =>) \{\s*([\w$]+\(\);)\s*\}$/.exec( handler );

		if ( body !== null ) call = body[ 1 ];

	}

	if ( call === null || code.slice( close, close + 2 ) !== ');' ) return code;

	return code.slice( 0, match.index ) + match[ 1 ] + call + code.slice( close + 2 );

}

function parseAudioElements( html ) {

	const audios = {};

	for ( const match of html.matchAll( /<audio\b([^>]*)>(.*?)<\/audio>/gs ) ) {

		const id = /\bid="([^"]*)"/.exec( match[ 1 ] );

		if ( id === null ) continue;

		const sources = [ ...match[ 2 ].matchAll( /<source\b[^>]*\bsrc="([^"]*)"[^>]*>/g ) ].map( ( m ) => m[ 1 ] );
		const own = /\bsrc="([^"]*)"/.exec( match[ 1 ] );
		const src = own ? own[ 1 ] : sources.find( ( s ) => /\.mp3$/.test( s ) ) || sources[ 0 ];

		if ( src === undefined ) continue;

		audios[ id[ 1 ] ] = { src, loop: /(?:^|\s)loop(?:\s|=|$)/.test( match[ 1 ] ) };

	}

	return audios;

}

function replaceAudioElements( code, audios ) {

	for ( const [ id, { src, loop } ] of Object.entries( audios ) ) {

		code = code.replace( new RegExp( `^([\\t ]*)((?:const |let |var )?)(\\w+) = document\\.getElementById\\( ?'${escapeRegExp( id )}' ?\\);\\n`, 'gm' ), ( all, indent, keyword, name ) => {

			return `${indent}${keyword}${name} = new Audio( ${quote( src )} );\n` + ( loop ? `${indent}${name}.loop = true;\n` : '' );

		} );

	}

	return code;

}

function statementEnd( code, index ) {

	const open = code.indexOf( '(', index );
	const close = findClosing( code, open );
	const end = code.indexOf( '\n', close );

	return end === - 1 ? code.length : end + 1;

}

function splitTopLevel( text ) {

	const parts = [];
	let depth = 0;
	let last = 0;

	for ( let i = 0; i < text.length; i ++ ) {

		const c = text[ i ];

		if ( c === '\'' || c === '"' || c === '`' ) {

			for ( i ++; i < text.length && text[ i ] !== c; i ++ ) if ( text[ i ] === '\\' ) i ++;

		} else if ( c === '(' || c === '[' || c === '{' ) depth ++;
		else if ( c === ')' || c === ']' || c === '}' ) depth --;
		else if ( c === ',' && depth === 0 ) {

			parts.push( text.slice( last, i ) );
			last = i + 1;

		}

	}

	parts.push( text.slice( last ) );

	return parts;

}

function dropCanvasOption( code ) {

	const pattern = /^([\t ]*)(?:const |let )?([\w.]+)\s*=\s*new (?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\(\s*\{/gm;
	let match;

	while ( ( match = pattern.exec( code ) ) !== null ) {

		const open = match.index + match[ 0 ].length - 1;
		const close = findClosing( code, open );
		const inner = code.slice( open + 1, close );

		if ( inner.includes( '\n' ) ) continue;

		const properties = splitTopLevel( inner ).map( ( p ) => p.trim() ).filter( ( p ) => p !== '' );
		const index = properties.findIndex( ( p ) => /^canvas(?:\s*:|$)/.test( p ) );

		if ( index === - 1 ) continue;

		const value = properties[ index ].includes( ':' ) ? properties[ index ].slice( properties[ index ].indexOf( ':' ) + 1 ).trim() : 'canvas';
		const indent = match[ 1 ];
		const renderer = match[ 2 ];
		const rest = properties.filter( ( p, i ) => i !== index );
		const replacement = rest.length === 0 ? '{}' : `{ ${rest.join( ', ' )} }`;

		if ( /^document\.createElement\( ?'canvas' ?\)$/.test( value ) ) {

			code = code.slice( 0, open ) + replacement + code.slice( close + 1 );
			continue;

		}

		if ( ! /^[\w$]+$/.test( value ) ) continue;

		const creation = new RegExp( `^([\\t ]*)((?:const |let |var )?)${value} = document\\.createElement\\( ?'canvas' ?\\);[\\t ]*\\n`, 'm' ).exec( code );

		if ( creation === null || creation.index > match.index ) continue;

		const between = code.slice( creation.index + creation[ 0 ].length, match.index );

		if ( countReferences( between, value ) > 0 ) continue;

		const end = statementEnd( code, match.index );
		const after = code.slice( 0, open ) + replacement + code.slice( close + 1, end );
		const tail = code.slice( end );
		const used = countReferences( code.slice( 0, creation.index ) + tail, value ) > ( creation[ 2 ] === '' ? 1 : 0 );
		const assignment = used ? `${indent}${creation[ 2 ]}${value} = ${renderer}.domElement;\n` : '';

		const head = removeLines( after.slice( 0, creation.index ) + '\uE000\n' + after.slice( creation.index + creation[ 0 ].length ), [ /^\uE000$/ ] );

		code = head + assignment + tail;

		if ( ! used && creation[ 2 ] === '' ) code = removeFromDeclarationList( code, value );

		pattern.lastIndex = 0;

	}

	return code;

}

function fixControlsElement( code ) {

	const renderer = findRenderer( code );
	const names = new Set();

	code = code.replace( /(new \w*Controls\( [\w.]+, )(\w+)( \))/g, ( all, head, name, tail ) => {

		if ( ! new RegExp( `^[\\t ]*(?:const |let |var )?${name} = document\\.(?:getElementById|querySelector)\\(`, 'm' ).test( code ) ) return all;

		names.add( name );

		return head + renderer + '.domElement' + tail;

	} );

	for ( const name of names ) code = pruneUnusedVariable( code, name );

	const creation = new RegExp( `^([\\t ]*)(?:const |let )?${renderer} = new (?:THREE\\.)?(?:WebGLRenderer|WebGPURenderer)\\(`, 'm' ).exec( code );

	if ( creation === null ) return code;

	const controls = new RegExp( `^([\\t ]*)(?:const |let )?(\\w+) = new \\w*Controls\\( [\\w.]+, ${renderer}\\.domElement \\);\\n`, 'gm' );
	let match;

	while ( ( match = controls.exec( code ) ) !== null ) {

		const indent = match[ 1 ];

		if ( match.index > creation.index || indent !== creation[ 1 ] ) continue;

		const lines = code.slice( match.index, creation.index ).split( '\n' );

		if ( lines.some( ( line ) => line.trim() !== '' && indentWidth( /^[\t ]*/.exec( line )[ 0 ] ) < indentWidth( indent ) ) ) continue;

		const member = new RegExp( `^${indent}${match[ 2 ]}\\.[^\\n]*\\n` );
		let blockEnd = match.index + match[ 0 ].length;
		let line;

		while ( ( line = member.exec( code.slice( blockEnd ) ) ) !== null ) blockEnd += line[ 0 ].length;

		const block = code.slice( match.index, blockEnd );
		const removeEnd = /^[\t ]*\n/.test( code.slice( blockEnd ) ) ? blockEnd + /^[\t ]*\n/.exec( code.slice( blockEnd ) )[ 0 ].length : blockEnd;
		const without = code.slice( 0, match.index ) + code.slice( removeEnd );
		const start = creation.index - ( removeEnd - match.index );
		let insert = statementEnd( without, start );
		const rendererLine = new RegExp( `^${indent}${renderer}\\.[^\\n]*\\n` );

		while ( ( line = rendererLine.exec( without.slice( insert ) ) ) !== null ) insert += line[ 0 ].length;

		code = without.slice( 0, insert ) + '\n' + block + without.slice( insert );

		return code;

	}

	return code;

}

function rewriteContainers( code ) {

	const renderer = findRenderer( code );

	code = removeLines( code, [ /^\s*document\.getElementById\( '[\w-]*' \)\.appendChild\( \w+\.domElement \);\s*$/ ] );

	const declaration = /^[\t ]*(?:const |let |var )?(container\w*) = document\.(?:getElementById\( 'container\w*' \)|createElement\( 'div' \));[^\n]*\n/gm;
	const names = [ ...code.matchAll( declaration ) ].map( ( m ) => m[ 1 ] );

	if ( names.length !== 1 || ( code.match( /getElementById\( 'container/g ) || [] ).length > 1 ) return code;

	const name = names[ 0 ];

	code = code.replace( declaration, '' );
	code = removeLines( code, [ new RegExp( `^\\s*${name}\\.innerHTML = '';\\s*$` ) ] );
	code = mapCode( code, ( segment ) => segment
		.replace( new RegExp( `(?<![\\w$.])${name}\\.(?:offset|client)Width\\b`, 'g' ), 'window.innerWidth' )
		.replace( new RegExp( `(?<![\\w$.])${name}\\.(?:offset|client)Height\\b`, 'g' ), 'window.innerHeight' )
		.replace( new RegExp( `(?<![\\w$.'"])${name}(?![\\w$'"]|\\s*:)`, 'g' ), `${renderer}.domElement` ) );

	return removeFromDeclarationList( code, `${renderer}.domElement` ).replace( /\n{3,}/g, '\n\n' );

}

function addRendererWindow( code ) {

	const pattern = /new (?:THREE\.)?(?:WebGLRenderer|WebGPURenderer)\(/g;
	let result = '';
	let last = 0;
	let match;

	while ( ( match = pattern.exec( code ) ) !== null ) {

		const open = match.index + match[ 0 ].length - 1;
		const close = findClosing( code, open );
		const inner = code.slice( open + 1, close );
		const trimmed = inner.trim();

		let replacement;

		if ( trimmed === '' || trimmed === '{}' ) {

			replacement = '( { window: sdlWindow } )';

		} else if ( /^\/\*.*\*\/$/s.test( trimmed ) ) {

			replacement = `( { window: sdlWindow } ${trimmed} )`;

		} else if ( trimmed.startsWith( '{' ) && trimmed.endsWith( '}' ) ) {

			const body = trimmed.slice( 1, - 1 );

			if ( body.includes( '\n' ) ) {

				const indent = /\n([\t ]*)\S/.exec( body )[ 1 ];
				replacement = `(${inner.slice( 0, inner.indexOf( '{' ) )}{\n${indent}window: sdlWindow,${body}}${inner.slice( inner.lastIndexOf( '}' ) + 1 )})`;

			} else {

				const properties = body.trim();
				replacement = `( { ${properties === '' ? '' : properties + ', '}window: sdlWindow } )`;

			}

		} else {

			replacement = `( { ...${trimmed}, window: sdlWindow } )`;

		}

		result += code.slice( last, open ) + replacement;
		last = close + 1;
		pattern.lastIndex = last;

	}

	return result + code.slice( last );

}

function convert( name, html ) {

	const { title, scripts } = parseHtml( html );
	const reasons = [];

	const modules = scripts.filter( ( s ) => /type="module"/.test( s.attributes ) );
	const shaderScripts = scripts.filter( ( s ) => /\bid="/.test( s.attributes ) && /type="x-shader/.test( s.attributes ) );
	const others = scripts.filter( ( s ) => ! modules.includes( s ) && ! shaderScripts.includes( s ) && ! /importmap/.test( s.attributes ) );

	if ( modules.length !== 1 ) return { status: 'skipped', reasons: [ 'module scripts: ' + modules.length ] };

	let usesAmmo = false;

	for ( const script of others ) {

		const source = /src="([^"]*)"/.exec( script.attributes );

		if ( source !== null && /\/ammo\.(?:wasm\.)?js$/.test( source[ 1 ] ) ) {

			usesAmmo = true;
			continue;

		}

		reasons.push( 'script: ' + ( source ? source[ 1 ] : 'inline ' + ( /type="([^"]*)"/.exec( script.attributes )?.[ 1 ] ?? 'text' ) ) );

	}

	if ( UNSUPPORTED_PREFIXES.test( name ) ) return { status: 'unsupported', reasons: [ 'family' ] };
	if ( UNSUPPORTED_CODE.test( html ) ) return { status: 'unsupported', reasons: [ 'video/audio/xr' ] };

	const importMap = scripts.find( ( s ) => /importmap/.test( s.attributes ) );

	let code = inspectorToGUI( resolveImports( modules[ 0 ].text, importMap ) );

	code = dedent( code.replace( /^\n+/, '' ).replace( /\s+$/, '' ) );

	if ( usesAmmo || /\bAmmoPhysics\b/.test( code ) ) code = `import '${AMMO_SPECIFIER}';\n` + code;

	const importPattern = /^import\s(?:[^;]*?\sfrom\s)?(['"])([^'"]+)\1;?[ \t]*(?:\/\/[^\n]*)?\n/gm;
	const imports = [ ...code.matchAll( importPattern ) ];

	if ( imports.length === 0 ) return { status: 'skipped', reasons: [ 'no imports' ] };

	for ( const entry of imports ) {

		const specifier = entry[ 2 ];

		if ( /^https?:/.test( specifier ) ) reasons.push( 'remote import: ' + specifier );
		else if ( ! /^(?:@kmamal\/three(?:\/|$)|\.|node:)/.test( specifier ) && ! dependencies.has( /^(?:@[^/]+\/)?[^/]+/.exec( specifier )[ 0 ] ) ) reasons.push( 'external import: ' + specifier );

	}

	const usesWebGPU = /WebGPURenderer/.test( code );
	const usesWebGL = /WebGLRenderer/.test( code );

	if ( usesWebGPU && usesWebGL ) reasons.push( 'both renderers' );
	if ( ! usesWebGPU && ! usesWebGL ) reasons.push( 'no renderer' );

	const api = usesWebGPU ? 'webgpu' : 'webgl';

	if ( /\bforceWebGL\b/.test( code ) && ! /^(?:const|let) forceWebGL = false;/m.test( code ) ) reasons.push( 'forceWebGL' );

	const lastImport = imports[ imports.length - 1 ];
	const importsEnd = lastImport.index + lastImport[ 0 ].length;

	const shaders = {};

	for ( const script of shaderScripts ) {

		const id = /\bid="([^"]*)"/.exec( script.attributes )[ 1 ];
		shaders[ id ] = dedent( script.text.replace( /^\n+/, '' ).replace( /\s+$/, '' ) );

	}

	const canvases = {};

	for ( const match of html.matchAll( /<canvas\b([^>]*)>/g ) ) {

		const id = /\bid="([^"]*)"/.exec( match[ 1 ] );

		if ( id === null ) continue;

		const width = /\bwidth="(\d+)"/.exec( match[ 1 ] );
		const height = /\bheight="(\d+)"/.exec( match[ 1 ] );

		canvases[ id[ 1 ] ] = [ width && `width: ${width[ 1 ]}`, height && `height: ${height[ 1 ]}` ].filter( Boolean );

	}

	let body = code.slice( importsEnd );

	for ( const [ id, sizes ] of Object.entries( canvases ) ) {

		const replacement = sizes.length === 0 ? 'document.createElement( \'canvas\' )' : `Object.assign( document.createElement( 'canvas' ), { ${sizes.join( ', ' )} } )`;

		body = body.replace( new RegExp( `document\\.getElementById\\( ?'${id}' ?\\)`, 'g' ), replacement );

	}

	body = replaceAudioElements( body, parseAudioElements( html ) );

	const head = code.slice( 0, importsEnd );

	const usedShaders = [];

	for ( const id of Object.keys( shaders ) ) {

		const key = /^[A-Za-z_$][\w$]*$/.test( id ) ? `shaders.${id}` : `shaders[ ${quote( id )} ]`;
		const before = body;

		body = body.replace( new RegExp( `document\\.getElementById\\( ?['"]${id}['"] ?\\)\\.textContent`, 'g' ), key );
		body = body.replace( new RegExp( `document\\.querySelector\\( ?['"]#${id}['"] ?\\)\\.textContent`, 'g' ), key );

		if ( body !== before ) usedShaders.push( id );

	}

	body = removeLines( body, [
		/^\s*document\.body\.appendChild\( (?:renderer\w*|stats|labelRenderer)\.(?:domElement|dom) \);\s*$/,
		/^\s*\w+\.appendChild\( (?:renderer\w*\.domElement|stats\.dom(?:Element)?) \);\s*$/,
		/^\s*document\.body\.appendChild\( WebGPU\.getErrorMessage\(\) \);\s*$/,
		/^\s*document\.body\.removeChild\( renderer\w*\.domElement \);\s*$/,
	] );

	for ( const variable of [ 'container', 'container1', 'container2', 'canvasContainer' ] ) {

		body = removeLines( body, [ new RegExp( `^\\s*document\\.body\\.appendChild\\( ${variable} \\);\\s*$` ) ] );
		body = pruneUnusedVariable( body, variable );

	}

	body = rewriteContainers( body );
	body = fixControlsElement( body );
	body = dropCanvasOption( body );
	body = removeStartButton( body );

	for ( const name of [ 'innerWidth', 'innerHeight', 'devicePixelRatio' ] ) {

		if ( new RegExp( `(?:const|let|var)\\s+${name}\\b|(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*=\\s*window` ).test( body ) ) continue;

		body = mapCode( body, ( segment ) => segment.replace( new RegExp( `(?<![\\w$.'"])${name}\\b(?!\\s*:)`, 'g' ), `window.${name}` ) );

	}

	body = removeLines( body, [
		/^\s*(?:const |let |var )?link = document\.createElement\( 'a' \);\s*$/,
		/^\s*link\.style\.display = 'none';\s*$/,
		/^\s*document\.body\.appendChild\( link \);[^\n]*$/,
	] );

	body = body.replace( /link\.href = URL\.createObjectURL\( (\w+) \);\s*link\.download = (\w+);\s*link\.click\(\);/g, 'saveFile( $1, $2 );' );
	body = mapCode( body, ( segment ) => segment.replace( /(?<![\w$.])(requestAnimationFrame|cancelAnimationFrame)\(/g, 'window.$1(' ) );
	body = addRendererWindow( body );

	let header = '';

	const needsDocument = /(?<![\w$.'"])document(?![\w$'"])/.test( body );
	const needsWindow = /(?<![\w$.'"])window(?![\w$'"])/.test( body );

	const names = [ 'createWindow' ];
	if ( /(?<![\w$.])saveFile\(/.test( body ) ) names.push( 'saveFile' );
	if ( needsWindow ) names.push( 'window' );
	if ( needsDocument ) names.push( 'document' );

	header += `import { ${names.join( ', ' )} } from '@kmamal/three/addons/utils/SDLWindow.js';\n`;

	let setup = `\nconst sdlWindow = createWindow( { title: ${quote( title )}, api: '${api}' } );\n`;

	if ( usedShaders.length > 0 ) {

		setup += '\nconst shaders = {\n';
		setup += usedShaders.map( ( id ) => `\t${/^[A-Za-z_$][\w$]*$/.test( id ) ? id : quote( id )}: \`${escapeTemplate( shaders[ id ] )}\`` ).join( ',\n' );
		setup += '\n};\n';

	}

	const output = ( head + header + setup + body ).replace( /\n{3,}/g, '\n\n' ).replace( /\s+$/, '' ) + '\n';

	const found = DOM_CHECKS.filter( ( [ , pattern ] ) => pattern.test( output.replace( /^import[^\n]*\n/gm, '' ) ) ).map( ( [ label ] ) => label );

	reasons.push( ...found );

	return { status: reasons.length === 0 ? 'clean' : 'review', reasons, output };

}

function applyPatch( text, patch ) {

	const lines = text.split( '\n' );
	const patchLines = patch.split( '\n' );
	let offset = 0;

	for ( let i = 0; i < patchLines.length; i ++ ) {

		const header = /^@@ -(\d+)(?:,(\d+))? \+\d+(?:,\d+)? @@/.exec( patchLines[ i ] );

		if ( header === null ) continue;

		const before = [];
		const after = [];

		for ( i ++; i < patchLines.length && ! patchLines[ i ].startsWith( '@@' ); i ++ ) {

			const line = patchLines[ i ];

			if ( line.startsWith( '\\' ) ) continue;
			if ( line === '' && i === patchLines.length - 1 ) continue;

			const content = line.slice( 1 );

			if ( line[ 0 ] !== '+' ) before.push( content );
			if ( line[ 0 ] !== '-' ) after.push( content );

		}

		i --;

		const expected = Number( header[ 1 ] ) - ( header[ 2 ] === '0' ? 0 : 1 ) + offset;
		const matches = ( at ) => at >= 0 && at + before.length <= lines.length && before.every( ( line, j ) => lines[ at + j ] === line );
		let at = - 1;

		for ( let distance = 0; distance <= lines.length; distance ++ ) {

			if ( matches( expected - distance ) ) at = expected - distance;
			else if ( matches( expected + distance ) ) at = expected + distance;
			else continue;

			break;

		}

		if ( at === - 1 ) return null;

		lines.splice( at, before.length, ...after );
		offset += at - expected + after.length - before.length;

	}

	return lines.join( '\n' );

}

function generate( name ) {

	const html = fs.readFileSync( path.join( examples, name + '.html' ), 'utf8' );
	const result = convert( name, html );
	const file = path.join( patches, name + '.patch' );

	result.raw = result.output;

	if ( result.output !== undefined && fs.existsSync( file ) ) {

		result.output = applyPatch( result.output, fs.readFileSync( file, 'utf8' ) );

		if ( result.output === null ) result.error = 'patch does not apply: ' + path.relative( root, file );

	}

	return result;

}

function diff( name, from, to ) {

	const directory = fs.mkdtempSync( path.join( os.tmpdir(), 'port-examples-' ) );
	const a = path.join( directory, 'a' );

	fs.writeFileSync( a, from );

	const label = `examples/${name}.mjs`;
	const result = spawnSync( 'diff', [ '-u', '--label', 'a/' + label, '--label', 'b/' + label, a, '-' ], { input: to, encoding: 'utf8' } );

	fs.rmSync( directory, { recursive: true } );

	if ( result.status > 1 ) throw new Error( result.stderr );

	return result.stdout;

}

function main() {

	const args = process.argv.slice( 2 );
	const check = args.includes( '--check' );
	const updatePatches = args.includes( '--update-patches' );
	const showReport = args.includes( '--report' );
	const names = args.filter( ( a ) => ! a.startsWith( '--' ) );

	const all = fs.readdirSync( examples ).filter( ( f ) => f.endsWith( '.html' ) && f !== 'index.html' ).map( ( f ) => f.slice( 0, - 5 ) ).sort();
	const targets = names.length > 0 ? names : all;

	const report = {};
	const differing = [];
	const errors = [];
	const generated = new Set();
	let written = 0;

	for ( const name of targets ) {

		const result = generate( name );
		const file = path.join( examples, name + '.mjs' );
		const current = fs.existsSync( file ) ? fs.readFileSync( file, 'utf8' ) : null;

		report[ name ] = { status: result.status, reasons: result.reasons };

		if ( result.raw === undefined ) continue;

		generated.add( name );

		if ( updatePatches ) {

			const patchFile = path.join( patches, name + '.patch' );

			if ( current === null || current === result.raw ) {

				if ( fs.existsSync( patchFile ) ) fs.rmSync( patchFile );

			} else if ( current !== result.output ) {

				fs.mkdirSync( patches, { recursive: true } );
				fs.writeFileSync( patchFile, diff( name, result.raw, current ) );
				process.stdout.write( `updated ${path.relative( root, patchFile )}\n` );

			}

			continue;

		}

		if ( result.error !== undefined ) {

			errors.push( `${name}: ${result.error}` );
			continue;

		}

		if ( current === result.output ) continue;

		if ( check ) {

			differing.push( path.relative( root, file ) );
			continue;

		}

		fs.writeFileSync( file, result.output );
		written ++;

	}

	if ( names.length === 0 ) {

		for ( const file of fs.readdirSync( examples ).filter( ( f ) => f.endsWith( '.mjs' ) ).sort() ) {

			if ( ! generated.has( file.slice( 0, - 4 ) ) ) differing.push( `examples/${file} (no generator output)` );

		}

		for ( const file of fs.existsSync( patches ) ? fs.readdirSync( patches ).sort() : [] ) {

			if ( ! generated.has( file.slice( 0, - 6 ) ) ) errors.push( `${file}: no generator output` );

		}

	}

	if ( showReport ) process.stdout.write( JSON.stringify( report, null, 1 ) + '\n' );

	for ( const error of errors ) process.stderr.write( `error: ${error}\n` );

	if ( check ) {

		for ( const file of differing ) process.stderr.write( `differs: ${file}\n` );

		if ( differing.length > 0 || errors.length > 0 ) process.exit( 1 );

		process.stdout.write( `${generated.size} examples up to date\n` );
		return;

	}

	if ( updatePatches ) return;

	for ( const file of differing ) process.stderr.write( `warning: ${file}\n` );

	process.stdout.write( `${written} of ${generated.size} examples written\n` );

	if ( errors.length > 0 ) process.exit( 1 );

}

main();
