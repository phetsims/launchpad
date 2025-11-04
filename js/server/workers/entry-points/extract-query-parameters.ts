// Copyright 2025, University of Colorado Boulder

/**
 * Worker for extracting query parameters (including typescript parsing).
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import { logger } from '../../logging.js';
import { QueryParameter, Repo } from '../../../types/common-types.js';
import { extractQueryParameters } from '../extractQueryParameters.js';

const ROOT_DIR = Piscina.workerData.ROOT_DIR;

logger.info( `Starting extract-query-parameter worker, ROOT_DIR: ${ROOT_DIR}` );

if ( !ROOT_DIR ) {
  throw new Error( 'ROOT_DIR is not defined in workerData' );
}

// eslint-disable-next-line phet/default-export-match-filename
export default async function extract( info: { repo: Repo; directory: string } ): Promise<QueryParameter[]> {
  const startTime = Date.now();

  const result = await extractQueryParameters( info.repo, info.directory );

  logger.info( `Extracted query parameters for ${info.repo} ${info.directory} in ${Date.now() - startTime} ms, ${result.length} query parameters` );

  return result;
}