// Copyright 2025, University of Colorado Boulder

/**
 * Query parameter options!
 *
 * NOTE: it looks like we're including the base query parameters (?ea works)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { enableAssert } from 'scenerystack/assert';
import { QueryStringMachine } from 'scenerystack/query-string-machine';

export const clientQueryParameters = QueryStringMachine.getAll( {
  ea: { type: 'flag' }
} );

// eslint-disable-next-line no-undef
if ( process.env.NODE_ENV === 'development' ) {
  console.log( 'running from dev build' );
}

// eslint-disable-next-line no-undef
if ( clientQueryParameters.ea || process.env.NODE_ENV === 'development' ) {
  console.log( 'enabling scenerystack assertions' );
  enableAssert();
}