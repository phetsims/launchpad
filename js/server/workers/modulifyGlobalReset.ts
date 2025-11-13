// Copyright 2025, University of Colorado Boulder

/**
 * Handle global reloading of modulify processes --- we will spawn workers with modulifySAB
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { workerData } from 'worker_threads';
import { logger } from '../logging.js';

// Exported, so it can be provided to workers
export const modulifySAB = workerData?.modulifySAB ?? new SharedArrayBuffer( Int32Array.BYTES_PER_ELEMENT );

const modulifyControl = new Int32Array( modulifySAB );
let modulifyVersion = Atomics.load( modulifyControl, 0 );

// initialize if we are the main thread
if ( !workerData?.modulifySAB ) {
  logger.info( 'Initializing modulifyControl SharedArrayBuffer' );

  modulifyControl[ 0 ] = 0;
}

// Triggers a reload of all modulify processes (from all workers)
export const reloadAllModulifyProcesses = (): void => {
  logger.info( 'Globally (lazily) reloading modulify processes' );

  Atomics.add( modulifyControl, 0, 1 );
};

// Returns false if the modulify version has changed since the last call
export const isModulifyUpToDate = (): boolean => {
  const newModulifyVersion = Atomics.load( modulifyControl, 0 );
  if ( newModulifyVersion !== modulifyVersion ) {
    modulifyVersion = newModulifyVersion;

    return false;
  }
  return true;
};