// Copyright 2025, University of Colorado Boulder

/**
 * Emitter for when launch should be triggered
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TinyEmitter } from 'scenerystack/axon';

export const launchTriggerEmitter = new TinyEmitter();

// Globally fire TODO: do this from elsewhere
document.body.addEventListener( 'keydown', e => {
  // if enter is pressed
  if ( e.keyCode === 13 ) {
    launchTriggerEmitter.emit();
  }
} );