export async function load( url, context, nextLoad ) {

	const result = await nextLoad( url, context );

	if ( url.endsWith( '/src/math/MathUtils.js' ) && result.source ) {

		result.source = String( result.source ).replace( /Math\.random\(\) \* 0xffffffff/g, 'Math._random() * 0xffffffff' );

	}

	return result;

}
