// Copyright 2025, University of Colorado Boulder

/**
 * Assorted API calls to the server
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Branch, BranchInfo, LogEvent, Repo, RepoList, SHA } from '../types/common-types.js';

export const apiGetRepoList = async (): Promise<RepoList> => {
  const response = await fetch( 'api/repo-list' );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch repo list: ${response.status} ${response.statusText}` );
  }

  return ( await response.json() ).repoList as Promise<RepoList>;
};

export const apiGetBranchInfo = async ( repo: Repo, branch: Branch ): Promise<BranchInfo> => {
  const response = await fetch( `api/branch-info/${repo}/${branch}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch branch info: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  return ( await response.json() ) as Promise<BranchInfo>;
};

// Resolves with success
export const apiBuild = async ( repo: Repo, branch: Branch, onOutput: ( str: string ) => void ): Promise<boolean> => {
  const response = await fetch( `api/build/${repo}/${branch}`, { method: 'POST' } );

  if ( !response.ok ) {
    throw new Error( `Failed to trigger build: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  const result = ( await response.json() ) as { buildJobID: number };

  const buildJobID = result.buildJobID;

  return apiBuildEvents( buildJobID, onOutput );
};

export const apiBuildEvents = async ( buildJobID: number, onOutput: ( str: string ) => void ): Promise<boolean> => {
  const eventSource = new EventSource( `api/build-events/${buildJobID}` );

  return new Promise( ( resolve, reject ) => {
    eventSource.addEventListener( 'error', event => {
      eventSource.close();
    } );

    eventSource.addEventListener( 'message', event => {
      const data = JSON.parse( event.data ) as {
        type: 'output';
        text: string;
      } | {
        type: 'completed';
        success: boolean;
      };

      if ( data.type === 'output' ) {
        onOutput( data.text );
      }
      else if ( data.type === 'completed' ) {
        eventSource.close();
        resolve( data.success );
      }
    } );
  } );
};

// Resolves with success
export const apiUpdate = async ( repo: Repo, branch: Branch ): Promise<boolean> => {
  const response = await fetch( `api/update/${repo}/${branch}`, { method: 'POST' } );

  if ( !response.ok ) {
    throw new Error( `Failed to trigger update checkout: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  const result = ( await response.json() ) as { updateJobID: number };

  const updateJobID = result.updateJobID;

  return apiUpdateEvents( updateJobID );
};

export const apiUpdateEvents = async ( updateJobID: number ): Promise<boolean> => {
  const eventSource = new EventSource( `api/update-events/${updateJobID}` );

  return new Promise( ( resolve, reject ) => {
    eventSource.addEventListener( 'error', event => {
      eventSource.close();
    } );

    eventSource.addEventListener( 'message', event => {
      const data = JSON.parse( event.data ) as {
        type: 'completed';
        success: boolean;
      };

      if ( data.type === 'completed' ) {
        eventSource.close();
        resolve( data.success );
      }
    } );
  } );
};

// Returns a promise that will only resolve when the EventSource is closed
export const logEvents = ( onLogEvent: ( logEvent: LogEvent ) => void ): Promise<void> => {
  const eventSource = new EventSource( 'api/log-events' );

  eventSource.addEventListener( 'error', event => {
    eventSource.close();
  } );

  eventSource.addEventListener( 'message', event => {
    onLogEvent( JSON.parse( event.data ) as LogEvent );
  } );

  return new Promise( ( resolve, reject ) => {
    eventSource.addEventListener( 'close', event => {
      eventSource.close();
      resolve();
    } );
  } );
};

export const getLastNotableEvents = async (): Promise<{
  lastErrorLogEvents: LogEvent[];
  lastWarnLogEvents: LogEvent[];
}> => {
  const response = await fetch( 'api/last-notable-events' );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch last notable events: ${response.status} ${response.statusText}` );
  }

  return ( ( await response.json() ) as {
    lastErrorLogEvents: LogEvent[];
    lastWarnLogEvents: LogEvent[];
  } );
};

export const getLatestSHAs = async ( repos: Repo[] ): Promise<Record<Repo, SHA>> => {
  const response = await fetch( `api/latest-shas/${repos.join( ',' )}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch latest SHAs: ${response.status} ${response.statusText}` );
  }

  return ( await response.json() ) as Promise<Record<Repo, SHA>>;
};

export const getLatestSHA = async ( repo: Repo, branch: Branch ): Promise<SHA> => {
  const response = await fetch( `api/latest-sha/${repo}/${branch}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch latest SHA: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  return ( ( await response.json() ) as { sha: SHA } ).sha;
};