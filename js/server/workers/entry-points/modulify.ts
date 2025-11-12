// Copyright 2025, University of Colorado Boulder

/**
 * Worker for modulifying files
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import { logger } from '../../logging.js';
import { getModulifiedFile } from '../modulifyAPI.js';
import { SHA } from '../../../types/common-types.js';

const ROOT_DIR: string = Piscina.workerData.ROOT_DIR;

logger.info( `Starting bundle worker, ROOT_DIR: ${ROOT_DIR}` );

if ( !ROOT_DIR ) {
  throw new Error( 'ROOT_DIR is not defined in workerData' );
}

export default async function modulify( data: { relativePath: string; chipperSHA: SHA; perennialSHA: SHA } ): Promise<string | null> {
  const startTime = Date.now();

  const result = await getModulifiedFile( data.relativePath, data.chipperSHA, data.perennialSHA );

  logger.verbose( `Modulified ${data.relativePath} in ${Date.now() - startTime} ms, ${result.modulified ? result.fileContents.length : 0} bytes` );

  return result.modulified ? result.fileContents : null;
}