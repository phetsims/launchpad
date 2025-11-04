// Copyright 2025, University of Colorado Boulder

/**
 * Logging for launchpad
 *
 * NOTE: This is meant to be used both from the main thread (actually logs) and through the Piscina worker threads
 * (will forward them to the main thread, which will log).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// NOTE: these exports aren't available, so we are including
// our own version of winston:
// import { createLogger, format, transports } from '../../../perennial/js/npm-dependencies/winston.js';
// eslint-disable-next-line no-restricted-imports
import { createLogger, format, transports } from 'winston';
import { logLevel } from './options.js';
import { default as perennialWinston } from '../../../perennial/js/npm-dependencies/winston.js';
import { isMainThread, threadId, parentPort } from 'node:worker_threads';
// NOTE: Don't import anything that isn't safe to import from worker threads!!!

// If we are on the main thread, we'll return a normal logger (with timestamps)
export const logger = isMainThread ? createLogger( {
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
} ) : {
  // Otherwise, in a worker thread we'll forward the logs to the parent thread

  silly: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'silly', message: `[worker ${threadId}] ${message}` } );
  },
  debug: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'debug', message: `[worker ${threadId}] ${message}` } );
  },
  verbose: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'verbose', message: `[worker ${threadId}] ${message}` } );
  },
  info: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'info', message: `[worker ${threadId}] ${message}` } );
  },
  warn: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'warn', message: `[worker ${threadId}] ${message}` } );
  },
  error: ( message: string ) => {
    parentPort?.postMessage( { logLevel: 'error', message: `[worker ${threadId}] ${message}` } );
  }
};

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