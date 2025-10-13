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