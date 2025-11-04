// Copyright 2025, University of Colorado Boulder

/**
 * Logging for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { LogEvent } from '../types/common-types.js';
import { logger } from './logging.js';

const LAST_LOG_QUANTITY = 20;
export const lastErrorLogEvents: LogEvent[] = [];
export const lastWarnLogEvents: LogEvent[] = [];

const logCallbacks: ( ( event: LogEvent ) => void )[] = [
  ( event: LogEvent ) => {
    if ( event.level === 'error' ) {
      lastErrorLogEvents.push( event );
      while ( lastErrorLogEvents.length > LAST_LOG_QUANTITY ) {
        lastErrorLogEvents.shift();
      }
    }
    if ( event.level === 'warn' ) {
      lastWarnLogEvents.push( event );
      while ( lastWarnLogEvents.length > LAST_LOG_QUANTITY ) {
        lastWarnLogEvents.shift();
      }
    }
  }
];
export const addLogCallback = ( callback: ( event: LogEvent ) => void ): void => {
  logger.info( 'adding logger' );
  logCallbacks.push( callback );
};
export const removeLogCallback = ( callback: ( event: LogEvent ) => void ): void => {
  const index = logCallbacks.indexOf( callback );
  if ( index >= 0 ) {
    logCallbacks.splice( index, 1 );
  }
  logger.info( 'removing logger' );
};

logger.on( 'data', info => {
  for ( const callback of logCallbacks ) {
    try {
      callback( {
        message: info.message,
        level: info.level,
        timestamp: info.timestamp
      } );
    }
    catch( e ) {
      console.error( 'Error in log callback:', e );
    }
  }
} );