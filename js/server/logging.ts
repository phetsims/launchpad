// Copyright 2025, University of Colorado Boulder

/**
 * Logging for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// NOTE: these exports aren't available, so we are including
// our own version of winston:
// import { createLogger, format, transports } from '../../../perennial/js/npm-dependencies/winston.js';
// eslint-disable-next-line no-restricted-imports
import { createLogger, format, transports } from 'winston';
import { autoBuild, autoUpdate, checkClean, logLevel, numAutoBuildThreads, port, ROOT_DIR, useGithubAPI } from './options.js';
import { default as perennialWinston } from '../../../perennial/js/npm-dependencies/winston.js';
import { LogEvent } from '../types/common-types.js';

export const logger = createLogger( {
  format: format.combine(
    format.timestamp( { format: 'YYYY-MM-DD HH:mm:ss.SSS' } ),
    format.printf( ( { level, message, timestamp } ) => {
      return `${timestamp} ${level}: ${message}${level === 'error' ? '\nSTACK:\n' + new Error().stack : ''}`;
    } )
  ),
  transports: [
    new transports.Console( {
      level: logLevel
    } )
  ]
} );

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

// also try to hit the default logger
// NOTE: why did winston switch from "Console" to "console"??? --- npm update seemed to break it.
// @ts-expect-error This seems like the working "console", but it is typed incorrectly from how it is working
if ( perennialWinston.default.transports.console ) {
  // @ts-expect-error This seems like the working "console", but it is typed incorrectly from how it is working
  perennialWinston.default.transports.console.level = logLevel;
}
if ( perennialWinston.default.transports.Console ) {
  perennialWinston.default.transports.Console.level = logLevel;
}

logger.info( 'options:' );
logger.info( ` - port: ${port}` );
logger.info( ` - rootDirectory: ${ROOT_DIR}` );
logger.info( ` - autoUpdate: ${autoUpdate}` );
logger.info( ` - autoBuild: ${autoBuild}` );
logger.info( ` - numAutoBuildThreads: ${numAutoBuildThreads}` );
logger.info( ` - checkClean: ${checkClean}` );
logger.info( ` - logLevel: ${logLevel}` );
logger.info( ` - useGithubAPI: ${useGithubAPI}` );