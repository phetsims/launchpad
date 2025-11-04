// Copyright 2025, University of Colorado Boulder

/**
 * Worker for transpiling files using esbuild.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { transpileTS } from '../bundling.js';
// eslint-disable-next-line phet/default-import-match-filename
import fsPromises from 'fs/promises';
import { logger } from '../../logging.js';

logger.info( 'Starting transpile worker' );

export default async function transpile( filePath: string ): Promise<string> {
  const startTime = Date.now();

  const originalSource = await fsPromises.readFile( filePath, 'utf8' );
  const result = await transpileTS( originalSource, filePath );

  logger.info( `Transpiled ${filePath} in ${Date.now() - startTime} ms, ${result.length} bytes` );

  return result;
}