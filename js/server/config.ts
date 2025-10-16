// Copyright 2025, University of Colorado Boulder

/**
 * Config for the launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { fileURLToPath } from 'url';
import path, { dirname, resolve } from 'path';
import fs from 'fs';

export type Config = {
  basicAuthUser?: string;
  basicAuthPassword?: string;
  githubToken?: string;
};

const __filename = fileURLToPath( import.meta.url );
const __dirname = dirname( __filename );

export let config: Config = {};
const configFile = path.join( resolve( __dirname, '../../..' ), 'launchpad/config.json' );

if ( fs.existsSync( configFile ) ) {
  config = JSON.parse( fs.readFileSync( configFile, 'utf8' ) );
}
else {
  console.log( `No config file found at ${configFile}, proceeding with defaults.` );
}