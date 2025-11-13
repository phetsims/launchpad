// Copyright 2025, University of Colorado Boulder

/**
 * Worker for bundling files using esbuild.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { bundleFile } from '../bundling.js';
import { logger } from '../../logging.js';
import { ROOT_DIR } from '../../options.js';

logger.info( `Starting bundle worker, ROOT_DIR: ${ROOT_DIR}` );

if ( !ROOT_DIR ) {
  throw new Error( 'ROOT_DIR is not defined in workerData' );
}

export default async function bundle( data: { filePath: string; modulify: boolean } ): Promise<string> {
  const startTime = Date.now();

  const result = await bundleFile( ROOT_DIR, data.filePath, data.modulify );

  logger.info( `Bundled${data.modulify ? ' and modulified' : ''} ${data.filePath} in ${Date.now() - startTime} ms, ${result.length} bytes` );

  return result;
}