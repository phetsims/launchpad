// Copyright 2025, University of Colorado Boulder

/**
 * Sleeps for a certain number of milliseconds
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export const clientSleep = async ( milliseconds: number ): Promise<void> => {
  return new Promise( ( resolve, reject ) => {
    setTimeout( resolve, milliseconds );
  } );
};