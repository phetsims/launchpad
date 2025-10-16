// Copyright 2025, University of Colorado Boulder

/**
 * Globals for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import pLimit from 'p-limit';

export const npmLimit = pLimit( 1 ); // limit npm operations to 1 at a time