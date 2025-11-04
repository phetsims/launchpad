// Copyright 2025, University of Colorado Boulder

/**
 * Worker for bundling files using esbuild.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import crypto from 'crypto';
import { logger } from '../../logging.js';

logger.info( 'Starting strong-etag worker' );

// eslint-disable-next-line phet/default-export-match-filename
export default function getStrongEtag( input: string, algorithm: 'sha1' | 'sha256' | 'md5' = 'sha256' ): string {
  const startTime = Date.now();

  const result = `"${algorithm}-${crypto.createHash( algorithm ).update( input ).digest( 'base64' )}"`;

  logger.info( `Hashed ${input.length} bytes in ${Date.now() - startTime} ms` );

  return result;
}