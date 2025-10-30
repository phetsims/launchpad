// Copyright 2025, University of Colorado Boulder

/**
 * Options for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import nopt from 'nopt';

const __filename = fileURLToPath( import.meta.url );
const __dirname = dirname( __filename );

const noptOptions = nopt( {}, {}, process.argv, 2 );

const getOptionIfProvided = <T>( keyName: string, defaultValue?: T ): T => {
  return noptOptions[ keyName ] !== undefined ? noptOptions[ keyName ] : defaultValue!;
};

export const options = {
  port: getOptionIfProvided( 'port', '45372' ),
  rootDirectory: getOptionIfProvided( 'rootDirectory', resolve( __dirname, '../../..' ) ),
  autoUpdate: getOptionIfProvided( 'autoUpdate', true ),
  autoBuild: getOptionIfProvided( 'autoBuild', true ),
  autoCheckoutReleaseBranches: getOptionIfProvided( 'autoCheckoutReleaseBranches', true ),
  numAutoBuildThreads: getOptionIfProvided( 'numAutoBuildThreads', 2 ),
  checkClean: getOptionIfProvided( 'checkClean', false ),

  // Logging level: silly, debug, verbose, info, warn, error
  logLevel: getOptionIfProvided( 'logLevel', 'verbose' ),

  // NOTE: this might run through rate limits very quickly if using the API, but it is faster for many things
  useGithubAPI: getOptionIfProvided( 'useGithubAPI', false )
};

export const port = parseInt( options.port, 10 );
if ( typeof port !== 'number' || isNaN( port ) || port < 0 || port > 65535 ) {
  throw new Error( `Invalid port: ${port}` );
}

export const ROOT_DIR = options.rootDirectory;
if ( typeof ROOT_DIR !== 'string' || !fs.existsSync( ROOT_DIR ) || !fs.statSync( ROOT_DIR ).isDirectory() ) {
  throw new Error( `Invalid rootDirectory: ${ROOT_DIR}` );
}

export const autoUpdate = options.autoUpdate;
if ( typeof autoUpdate !== 'boolean' ) {
  throw new Error( `Invalid autoUpdate: ${autoUpdate}` );
}

export const autoBuild = options.autoBuild;
if ( typeof autoBuild !== 'boolean' ) {
  throw new Error( `Invalid autoBuild: ${autoBuild}` );
}

export const autoCheckoutReleaseBranches = options.autoCheckoutReleaseBranches;
if ( typeof autoCheckoutReleaseBranches !== 'boolean' ) {
  throw new Error( `Invalid autoCheckoutReleaseBranches: ${autoCheckoutReleaseBranches}` );
}

export const numAutoBuildThreads = options.numAutoBuildThreads;
if ( typeof numAutoBuildThreads !== 'number' || isNaN( numAutoBuildThreads ) || numAutoBuildThreads < 1 ) {
  throw new Error( `Invalid numAutoBuildThreads: ${numAutoBuildThreads}` );
}

export const checkClean = options.checkClean;
if ( typeof checkClean !== 'boolean' ) {
  throw new Error( `Invalid checkClean: ${checkClean}` );
}

export const logLevel = options.logLevel;
if ( typeof logLevel !== 'string' || ![ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ].includes( logLevel ) ) {
  throw new Error( `Invalid logLevel: ${logLevel}` );
}

export const useGithubAPI = options.useGithubAPI;
if ( typeof useGithubAPI !== 'boolean' ) {
  throw new Error( `Invalid useGithubAPI: ${useGithubAPI}` );
}
