// Copyright 2025, University of Colorado Boulder

/**
 * Pools of workers for asynchronous tasks.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import { cacheModulification, ROOT_DIR } from './options.js';
import { logger } from './logging.js';
import { QueryParameter, Repo, SHA } from '../types/common-types.js';
import { modulifySAB } from './workers/modulifyGlobalReset.js';

const attachLogging = ( pool: Piscina, name: string ) => {
  pool.on( 'message', ( message: { logLevel: string; message: string } ) => {
    if ( message.logLevel ) {
      // @ts-expect-error dynamic access
      logger[ message.logLevel ]( `[${name} worker] ${message.message}` );
    }
  } );
};

const createPool = <T, U>( name: string, entryPoint: string ): Piscina<T, U> => {
  const pool = new Piscina<T, U>( {
    filename: new URL( entryPoint, import.meta.url ).href,
    minThreads: 1,
    maxThreads: 8,
    idleTimeout: 60 * 60 * 1000,
    workerData: {
      ROOT_DIR: ROOT_DIR,
      cacheModulification: cacheModulification,
      modulifySAB: modulifySAB
    }
  } );
  attachLogging( pool, name );

  return pool;
};

export const bundlePool = createPool<{ filePath: string; modulify: boolean }, string>(
  'bundle',
  './workers/entry-points/bundle.js'
);
export const transpilePool = createPool<string | { filePath: string; contents: string }, string>(
  'transpile',
  './workers/entry-points/transpile.js'
);
export const modulifyPool = createPool<{ relativePath: string; chipperSHA: SHA; perennialSHA: SHA }, string | null>(
  'modulify',
  './workers/entry-points/modulify.js'
);
export const getStrongEtagPool = createPool<string, string>(
  'strong-etag',
  './workers/entry-points/strong-etag.js'
);
export const getExtractQueryParametersPool = createPool<{ repo: Repo; directory: string }, QueryParameter[]>(
  'extract-query-parameters',
  './workers/entry-points/extract-query-parameters.js'
);