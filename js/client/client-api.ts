// Copyright 2025, University of Colorado Boulder

/**
 * Assorted API calls to the server
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Branch, BranchInfo, Commit, LogEvent, QueryParameter, Repo, RepoList, SHA } from '../types/common-types.js';

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
export const apiBuild = async (
  repo: Repo,
  branch: Branch,
  onOutput: ( str: string ) => void,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onStarted: () => void = () => {}
): Promise<boolean> => {
  const response = await fetch( `api/build/${repo}/${branch}`, { method: 'POST' } );

  if ( !response.ok ) {
    throw new Error( `Failed to trigger build: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  const result = ( await response.json() ) as { buildJobID: number };

  const buildJobID = result.buildJobID;

  onStarted();

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

export const getLastCommits = async ( repo: Repo, branch: Branch ): Promise<Commit[]> => {
  const response = await fetch( `api/last-commits/${repo}/${branch}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch last commits: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  return ( ( await response.json() ) as { commits: Commit[] } ).commits;
};

export const getWrappers = async (): Promise<string[]> => {
  const response = await fetch( 'api/wrappers' );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch wrappers: ${response.status} ${response.statusText}` );
  }

  return ( ( await response.json() ) as { wrappers: string[] } ).wrappers;
};

export const getQueryParameters = async ( repo: Repo, branch: Branch ): Promise<QueryParameter[]> => {
  const response = await fetch( `api/query-parameters/${repo}/${branch}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch query parameters: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  return ( ( await response.json() ) as { queryParameters: QueryParameter[] } ).queryParameters.filter( queryParameter => {
    // Sun query parameters are for the demo
    if ( queryParameter.repo === 'sun' ) {
      return false;
    }

    // Scenery-phet backgroundColor query parameter is for the demo
    if ( queryParameter.repo === 'scenery-phet' && queryParameter.name === 'backgroundColor' ) {
      return false;
    }

    return true;
  } );
};