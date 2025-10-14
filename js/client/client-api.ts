// Copyright 2025, University of Colorado Boulder

/**
 * Assorted API calls to the server
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, RepoList } from '../types/common-types.js';

export const apiGetRepoList = async (): Promise<RepoList> => {
  const response = await fetch( 'api/repo-list' );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch repo list: ${response.status} ${response.statusText}` );
  }

  return ( await response.json() ).repoList as Promise<RepoList>;
};

export const apiGetBranchInfo = async ( repo: string, branch: string ): Promise<BranchInfo> => {
  const response = await fetch( `api/branch-info/${repo}/${branch}` );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch branch info: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  return ( await response.json() ) as Promise<BranchInfo>;
};

// Resolves with success
export const apiBuild = async ( repo: string, branch: string, onOutput: ( str: string ) => void ): Promise<boolean> => {
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
export const apiUpdate = async ( repo: string, branch: string ): Promise<boolean> => {
  const response = await fetch( `api/update/${repo}/${branch}`, { method: 'POST' } );

  if ( !response.ok ) {
    throw new Error( `Failed to trigger update checkout: ${repo} ${branch} ${response.status} ${response.statusText}` );
  }

  const result = ( await response.json() ) as { updateCheckoutJobID: number };

  const updateCheckoutJobID = result.updateCheckoutJobID;

  return apiUpdateEvents( updateCheckoutJobID );
};

export const apiUpdateEvents = async ( updateCheckoutJobID: number ): Promise<boolean> => {
  const eventSource = new EventSource( `api/update-events/${updateCheckoutJobID}` );

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