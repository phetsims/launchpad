// Copyright 2025, University of Colorado Boulder

/**
 * Code for creating pools of child processes that can handle RPC calls to modulify files.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { fork, ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TIMEOUT_MS = 30000;

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
} );

export type ResolveRejectPackage = {
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

const modulifyProcess = spawnProcess();

let nextId = 1;

// Simple in-flight map to correlate requests
const packageMap = new Map<number, ResolveRejectPackage>();

modulifyProcess.on( 'message', ( response: ModulifyResponse | ErrorResponse ) => {
  const p = packageMap.get( response.id );

  if ( p ) {
    packageMap.delete( response.id );
    clearTimeout( p.timer );

    if ( response.type === 'error' ) {
      p.reject( new Error( response.message ) );
    }
    else {
      p.resolve( response );
    }
  }
} );

modulifyProcess.on( 'exit', ( code, signal ) => {
  for ( const [ , p ] of packageMap ) {
    clearTimeout( p.timer );
    p.reject( new Error( `worker exited (${code ?? signal})` ) );
  }
  packageMap.clear();
} );

export const getModulifiedFile = async ( file: string ): Promise<ModulifyResponse> => {
  const id = nextId++;

  return new Promise( ( resolve, reject ) => {
    const timer = setTimeout( () => {
      if ( packageMap.delete( id ) ) {
        reject( new Error( `modulify timeout for ${file}` ) );
      }
    }, TIMEOUT_MS );

    packageMap.set( id, {
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
  });
};