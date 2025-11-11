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

export const getModulifiedFile = async ( file: string ): Promise<ModulifyResponse> => {
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
  });
};