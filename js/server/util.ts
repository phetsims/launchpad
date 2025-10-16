// Copyright 2025, University of Colorado Boulder

/**
 * Assorted utility functions
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import path from 'path';
import fs from 'fs';
// eslint-disable-next-line phet/default-import-match-filename
import fsPromises from 'fs/promises';
import type { Branch, ModelBranchInfo, PackageJSON, Repo, RepoBranch, SHA } from '../types/common-types.js';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import npmUpdateDirectory from '../../../perennial/js/common/npmUpdateDirectory.js';
import ChipperVersion from '../../../perennial/js/common/ChipperVersion.js';
// eslint-disable-next-line phet/default-import-match-filename
import getBuildArgumentsImport from '../../../perennial/js/common/getBuildArguments.js';
import gruntCommand from '../../../perennial/js/common/gruntCommand.js';
import { githubGetLatestBranchSHA } from './github-api.js';
import { Model } from './model.js';
import { ROOT_DIR, useGithubAPI } from './options.js';
import { npmLimit } from './globals.js';
import getRemoteBranchSHAs from '../../../perennial/js/common/getRemoteBranchSHAs.js';

const execute = executeImport.default;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ReleaseBranch = ReleaseBranchImport.default;
const getBuildArguments = getBuildArgumentsImport.default;

export const getRepoDirectory = ( repo: Repo, branch: Branch ): string => {
  if ( branch === 'main' ) {
    return path.join( ROOT_DIR, repo );
  }
  else {
    return path.join( ROOT_DIR, 'release-branches', `${repo}-${branch}`, repo );
  }
};

export const getPackageJSON = async ( directory: string ): Promise<PackageJSON | null> => {
  const packageJSONFile = path.join( directory, 'package.json' );

  if ( fs.existsSync( packageJSONFile ) ) {
    return JSON.parse( await fsPromises.readFile( packageJSONFile, 'utf-8' ) );
  }
  else {
    return null;
  }
};

export const getDirectoryBranch = async ( directory: string ): Promise<Branch> => {
  return execute( 'git', [ 'symbolic-ref', '-q', 'HEAD' ], directory ).then( stdout => stdout.trim().replace( 'refs/heads/', '' ) );
};

export const getDirectorySHA = async ( directory: string ): Promise<SHA> => {
  return ( await execute( 'git', [ 'rev-parse', 'HEAD' ], directory ) ).trim();
};

export const getDirectoryTimestampBranch = async ( directory: string, branch: Branch ): Promise<number> => {
  return execute( 'git', [ 'show', '-s', '--format=%cd', '--date=iso', branch ], directory ).then( stdout => {
    return Promise.resolve( new Date( stdout.trim() ).getTime() );
  } );
};

export const getCurrentChipperVersion = (): ChipperVersion => {
  return ChipperVersion.getFromPackageJSON(
    JSON.parse( fs.readFileSync( `${ROOT_DIR}/chipper/package.json`, 'utf8' ) )
  );
};

export const isDirectoryClean = async ( directory: string ): Promise<boolean> => {
  return execute( 'git', [ 'status', '--porcelain' ], directory ).then( stdout => Promise.resolve( stdout.length === 0 ) );
};

export const updateReleaseBranchCheckout = async ( releaseBranch: ReleaseBranch ): Promise<void> => {
  return npmLimit( async () => {
    return releaseBranch.updateCheckout();
  } );
};

export const buildReleaseBranch = async ( releaseBranch: ReleaseBranch, onOutput: ( str: string ) => void ): Promise<void> => {
  await releaseBranch.build( {
    brands: releaseBranch.brands,
    lint: false,
    typeCheck: false,
    locales: '*',
    allHTML: true,
    debugHTML: true
  }, {
    onStdout: onOutput,
    onStderr: onOutput
  } );
};

export const buildMain = async ( branchInfo: ModelBranchInfo, onOutput: ( str: string ) => void ): Promise<void> => {
  const args = getBuildArguments( getCurrentChipperVersion(), {
    brands: branchInfo.brands,
    lint: false,
    typeCheck: false,
    locales: '*',
    allHTML: true,
    debugHTML: true
  } );

  await execute( gruntCommand, args, path.join( ROOT_DIR, branchInfo.repo ), {
    onStdout: onOutput,
    onStderr: onOutput
  } );
};

export const updateNodeModules = async ( directory: string ): Promise<void> => {
  return npmLimit( async () => {
    return npmUpdateDirectory( directory );
  } );
};

export const getStaleBranches = async ( model: Model ): Promise<RepoBranch[]> => {
  const repos = Object.keys( model.repos );

  const results: RepoBranch[] = [];

  await Promise.all( repos.map( async repo => {
    const branches = Object.keys( model.repos[ repo ].branches );

    // no-op if using GitHub API. Otherwise we will... request all of these at the same time (or limit in the future?)
    const branchSHAs = useGithubAPI ? {} : ( await getRemoteBranchSHAs( repo ) as Record<Repo, string> );

    for ( const branch of branches ) {
      if ( model.repos[ repo ].branches[ branch ].isCheckedOut ) {
        const localSHA = model.repos[ repo ].branches[ branch ].sha;
        const remoteSHA = useGithubAPI ? ( await githubGetLatestBranchSHA( model.repos[ repo ].owner, repo, branch ) ) : branchSHAs[ branch ];

        if ( localSHA && remoteSHA && localSHA !== remoteSHA ) {
          console.log( repo, branch, 'is stale', localSHA, remoteSHA );
          results.push( { repo: repo, branch: branch } );
        }
      }
    }
  } ) );

  return results;
};
