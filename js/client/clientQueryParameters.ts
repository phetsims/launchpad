// Copyright 2025, University of Colorado Boulder

/**
 * Query parameter options!
 *
 * NOTE: it looks like we're including the base query parameters (?ea works)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { QueryStringMachine } from 'scenerystack/query-string-machine';

export const clientQUeryParameters = QueryStringMachine.getAll( {
  local: {
    type: 'flag',
    public: true
  }
} );