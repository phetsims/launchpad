// Copyright 2025, University of Colorado Boulder

/**
 * Worker for bundling files using esbuild.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import { bundleFile } from '../bundling.js';
import { logger } from '../../logging.js';

const ROOT_DIR: string = Piscina.workerData.ROOT_DIR;

logger.info( `Starting bundle worker, ROOT_DIR: ${ROOT_DIR}` );

if ( !ROOT_DIR ) {
  throw new Error( 'ROOT_DIR is not defined in workerData' );
}

export default async function bundle( filePath: string ): Promise<string> {
  const startTime = Date.now();

  const result = await bundleFile( ROOT_DIR, filePath );

  logger.info( `Bundled ${filePath} in ${Date.now() - startTime} ms, ${result.length} bytes` );

  return result;
}