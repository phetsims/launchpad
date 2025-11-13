// Copyright 2025, University of Colorado Boulder

/**
 * Pools of workers for asynchronous tasks.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import { ROOT_DIR } from './options.js';
import { logger } from './logging.js';
import { QueryParameter, Repo, SHA } from '../types/common-types.js';
import { modulifySAB } from './workers/modulifyGlobalReset.js';

export const bundlePool = new Piscina<{ filePath: string; modulify: boolean }, string>( {
  filename: new URL( './workers/entry-points/bundle.js', import.meta.url ).href,
  minThreads: 1,
  maxThreads: 8,
  idleTimeout: 60 * 60 * 1000,
  workerData: {
    ROOT_DIR: ROOT_DIR,
    modulifySAB: modulifySAB
  }
} );
export const transpilePool = new Piscina<string | { filePath: string; contents: string }, string>( {
  filename: new URL( './workers/entry-points/transpile.js', import.meta.url ).href,
  minThreads: 1,
  maxThreads: 8,
  idleTimeout: 60 * 60 * 1000,
  workerData: {
    ROOT_DIR: ROOT_DIR,
    modulifySAB: modulifySAB
  }
} );
export const modulifyPool = new Piscina<{ relativePath: string; chipperSHA: SHA; perennialSHA: SHA }, string | null>( {
  filename: new URL( './workers/entry-points/modulify.js', import.meta.url ).href,
  minThreads: 1,
  maxThreads: 8,
  idleTimeout: 60 * 60 * 1000,
  workerData: {
    ROOT_DIR: ROOT_DIR,
    modulifySAB: modulifySAB
  }
} );
export const getStrongEtagPool = new Piscina<string, string>( {
  filename: new URL( './workers/entry-points/strong-etag.js', import.meta.url ).href,
  minThreads: 1,
  maxThreads: 8,
  idleTimeout: 60 * 60 * 1000,
  workerData: {
    ROOT_DIR: ROOT_DIR,
    modulifySAB: modulifySAB
  }
} );
export const getExtractQueryParametersPool = new Piscina<{ repo: Repo; directory: string }, QueryParameter[]>( {
  filename: new URL( './workers/entry-points/extract-query-parameters.js', import.meta.url ).href,
  minThreads: 1,
  maxThreads: 8,
  idleTimeout: 60 * 60 * 1000,
  workerData: {
    ROOT_DIR: ROOT_DIR,
    modulifySAB: modulifySAB
  }
} );

const attachLogging = ( pool: Piscina, name: string ) => {
  pool.on( 'message', ( message: { logLevel: string; message: string } ) => {
    if ( message.logLevel ) {
      // @ts-expect-error dynamic access
      logger[ message.logLevel ]( `[${name} worker] ${message.message}` );
    }
  } );
};

attachLogging( bundlePool, 'bundle' );
attachLogging( transpilePool, 'transpile' );
attachLogging( getStrongEtagPool, 'strong-etag' );
attachLogging( getExtractQueryParametersPool, 'extract-query-parameters' );