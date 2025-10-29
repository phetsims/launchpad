// Copyright 2025, University of Colorado Boulder

/**
 * From the wrapper path in perennial-alias/data/wrappers, get the name of the wrapper.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export const getWrapperName = ( wrapper: string ): string => {

  // If the wrapper has its own individual repo, then get the name 'classroom-activity' from 'phet-io-wrapper-classroom-activity'
  // Maintain compatibility for wrappers in 'phet-io-wrappers-'
  const wrapperParts = wrapper.split( 'phet-io-wrapper-' );
  const wrapperName = wrapperParts.length > 1 ?
                      wrapperParts[ 1 ] :
                      wrapper.startsWith( 'phet-io-sim-specific' ) ? wrapper.split( '/' )[ wrapper.split( '/' ).length - 1 ]
                                                                   : wrapper;

  // If the wrapper still has slashes in it, then it looks like 'phet-io-wrappers/active'
  const splitOnSlash = wrapperName.split( '/' );
  return splitOnSlash[ splitOnSlash.length - 1 ];
};