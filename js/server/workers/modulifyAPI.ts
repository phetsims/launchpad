// Copyright 2025, University of Colorado Boulder

/**
 * Code for creating pools of child processes that can handle RPC calls to modulify files.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import fs from 'fs';
// eslint-disable-next-line phet/default-import-match-filename
import fsPromises from 'fs/promises';
import * as ig from 'isomorphic-git';
import Piscina from 'piscina';
import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHA } from '../../types/common-types.js';
import { logger } from '../logging.js';

const TIMEOUT_MS = 30000;
const ROOT_DIR: string = Piscina.workerData.ROOT_DIR;

export type ModulifyRequest = {
  type: 'modulifyRequest';
  id: number;
  file: string;
};

export type ErrorResponse = {
  type: 'error';
  id: number;
  message: string;
};

export type ModulifyResponse = {
  type: 'modulifyResponse';
  id: number;
} & ( {
  modulified: false;
} | {
  modulified: true;
  fileContents: string;
  chipperSHA: string;
  perennialSHA: string;
  usedRelativeFiles: string[];
} );

export type ModulifyMetadata = {
  file: string;
  chipperSHA: string;
  perennialSHA: string;

  // usedRelativeFile => { mtime, size } | null (null if file didn't exist)
  statMap: Record<string, { mtime: number; size: number } | null>;
};

export type Inflight = {
  resolve: ( response: ModulifyResponse ) => void;
  reject: ( response: Error ) => void;

  // import from node:timers isn't working, and chipper doesn't seem to have @types/node
  timer: ReturnType<typeof setTimeout>;
};

const __filename = fileURLToPath( import.meta.url );
const __dirname = path.dirname( __filename );

function spawnProcess(): ChildProcess {
  const workerPath = path.resolve( __dirname, '../../../../chipper/js/grunt/modulify/modulifyForkServer.ts' );
  return fork( workerPath, [], {
    stdio: [ 'inherit', 'inherit', 'inherit', 'ipc' ],
    execArgv: process.execArgv.length ? process.execArgv : [ '-r', 'tsx' ]
  } );
}

// TODO: switch to "multiple" workers? --- or not
let modulifyProcess = spawnProcess();

let nextId = 1;

// Simple in-flight map to correlate requests
const inflightMap = new Map<number, Inflight>();

export const reloadModulify = (): void => {
  const oldModulifyProcess = modulifyProcess;

  const interval = setInterval( () => {
    if ( inflightMap.size === 0 ) {
      oldModulifyProcess.kill();

      clearInterval( interval );
    }
  }, 1000 );

  modulifyProcess = spawnProcess();
};

modulifyProcess.on( 'message', ( response: ModulifyResponse | ErrorResponse ) => {
  const inflight = inflightMap.get( response.id );

  if ( inflight ) {
    inflightMap.delete( response.id );
    clearTimeout( inflight.timer );

    if ( response.type === 'error' ) {
      console.error( response.message );
      inflight.reject( new Error( response.message ) );
    }
    else {
      inflight.resolve( response );
    }
  }
} );

modulifyProcess.on( 'exit', ( code, signal ) => {
  for ( const [ , inflight ] of inflightMap ) {
    clearTimeout( inflight.timer );
    inflight.reject( new Error( `worker exited (${code ?? signal})` ) );
  }
  inflightMap.clear();
} );

export const retrieveModulifiedFile = async ( file: string ): Promise<ModulifyResponse> => {
  const id = nextId++;

  return new Promise( ( resolve, reject ) => {
    const timer = setTimeout( () => {
      if ( inflightMap.delete( id ) ) {
        reject( new Error( `modulify timeout for ${file}` ) );
      }
    }, TIMEOUT_MS );

    inflightMap.set( id, {
      resolve: resolve,
      reject: reject,
      timer: timer
    } );

    const request: ModulifyRequest = {
      type: 'modulifyRequest',
      id: id,
      file: file
    };

    modulifyProcess.send( request );
  } );
};

const CACHE_DIR = path.resolve( ROOT_DIR, 'launchpad', 'cache', 'modulify-cache' );

const getStatMap = async ( usedRelativeFiles: string[] ): Promise<ModulifyMetadata['statMap']> => {
  const statMap: ModulifyMetadata['statMap'] = {};

  await Promise.all( usedRelativeFiles.map( async relativeFile => {
    const fullPath = path.resolve( ROOT_DIR, relativeFile );

    try {
      const stat = await fsPromises.stat( fullPath );

      statMap[ relativeFile ] = {
        mtime: stat.mtimeMs,
        size: stat.size
      };
    }
    catch( e ) {
      statMap[ relativeFile ] = null;
    }
  } ) );

  return statMap;
};

export const getModulifiedFile = async (
  file: string,
  chipperSHA: SHA | null,
  perennialSHA: SHA | null
): Promise<ModulifyResponse> => {
  const metadataCacheFile = path.resolve( CACHE_DIR, file + '_metadata.json' );
  const cachedContentFile = path.resolve( CACHE_DIR, file );

  const updateSHAs = async () => {
    if ( chipperSHA === null ) {
      // eslint-disable-next-line require-atomic-updates
      chipperSHA = await ig.resolveRef( {
        fs: fs,
        dir: path.resolve( ROOT_DIR, 'chipper' ),
        ref: 'HEAD'
      } );
    }

    if ( perennialSHA === null ) {
      // eslint-disable-next-line require-atomic-updates
      perennialSHA = await ig.resolveRef( {
        fs: fs,
        dir: path.resolve( ROOT_DIR, 'perennial-alias' ),
        ref: 'HEAD'
      } );
    }
  };

  try {

    if ( fs.existsSync( metadataCacheFile ) ) {
      await updateSHAs();

      const metadataContent: ModulifyMetadata = JSON.parse( await fsPromises.readFile( metadataCacheFile, 'utf8' ) );

      const usedRelativeFiles = Object.keys( metadataContent.statMap );

      let matches = true;
      if ( metadataContent.chipperSHA === chipperSHA && metadataContent.perennialSHA === perennialSHA ) {
        const statMap = await getStatMap( usedRelativeFiles );

        for ( const relativeFile of usedRelativeFiles ) {
          const previousStat = metadataContent.statMap[ relativeFile ];
          const currentStat = statMap[ relativeFile ];
          if ( previousStat === null && currentStat === null ) {
            // both didn't exist, continue
          }
          else if ( previousStat === null || currentStat === null ) {
            matches = false;
          }
          else if ( previousStat.mtime !== currentStat.mtime || previousStat.size !== currentStat.size ) {
            matches = false;
          }
        }
      }
      else {
        matches = false;
      }

      logger.verbose( 'Modulify cache ' + ( matches ? 'hit' : 'miss' ) + ` for ${file}` );

      if ( matches ) {
        const fileContents = await fsPromises.readFile( cachedContentFile, 'utf8' );

        await updateSHAs();

        return {
          type: 'modulifyResponse',
          id: 0, // id is not relevant here
          modulified: true,
          fileContents: fileContents,
          chipperSHA: chipperSHA!,
          perennialSHA: perennialSHA!,
          usedRelativeFiles: usedRelativeFiles
        };
      }
    }
  }
  catch( e ) {
    logger.error( `Error checking modulify cache for ${file}: ${e}` );
  }

  const modulifyResponse = await retrieveModulifiedFile( file );

  // Add actual modulified files to the cache (CONSIDER non-modulified files?)
  ( async () => {
    if ( modulifyResponse.modulified ) {
      await updateSHAs();

      const metadata: ModulifyMetadata = {
        file: file,
        chipperSHA: chipperSHA!,
        perennialSHA: perennialSHA!,
        statMap: await getStatMap( modulifyResponse.modulified ? modulifyResponse.usedRelativeFiles : [] )
      };

      await fsPromises.mkdir( path.dirname( metadataCacheFile ), { recursive: true } );
      await fsPromises.writeFile( metadataCacheFile, JSON.stringify( metadata ), 'utf8' );
      await fsPromises.writeFile( cachedContentFile, modulifyResponse.fileContents, 'utf8' );
    }
  } )().catch( e => {
    logger.error( `Error caching modulified file for ${file}: ${e}` );
  } );

  return modulifyResponse;
};