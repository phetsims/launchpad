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
import type { Branch, Commit, ModelBranchInfo, PackageJSON, Repo, SHA } from '../types/common-types.js';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';
import ChipperVersion from '../../../perennial/js/common/ChipperVersion.js';
// eslint-disable-next-line phet/default-import-match-filename
import getBuildArgumentsImport from '../../../perennial/js/common/getBuildArguments.js';
import gruntCommand from '../../../perennial/js/common/gruntCommand.js';
import { githubGetLatestBranchSHA } from './github-api.js';
import { Model } from './model.js';
import { ROOT_DIR, useGithubAPI } from './options.js';
import { npmLimit } from './globals.js';
import getRemoteBranchSHAs from '../../../perennial/js/common/getRemoteBranchSHAs.js';
import gitPullRebase from '../../../perennial/js/common/gitPullRebase.js';
import crypto from 'crypto';

const execute = executeImport.default;
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

export const updateMain = async ( repo: Repo ): Promise<void> => {
  await gitPullRebase( repo );
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

export const getLatestSHA = async ( model: Model, repo: Repo, branch: Branch ): Promise<SHA> => {
  if ( useGithubAPI ) {
    return githubGetLatestBranchSHA( model.repos[ repo ].owner, repo, branch );
  }
  else {
    return ( await getRemoteBranchSHAs( repo ) as Record<Repo, string> )[ branch ];
  }
};

// for main
export const getNPMHash = async ( repo: Repo ): Promise<string> => {
  const packageJSONFile = path.join( ROOT_DIR, repo, 'package.json' );
  const packageLockFile = path.join( ROOT_DIR, repo, 'package-lock.json' );

  const packageJSONContents = fs.existsSync( packageJSONFile ) ? await fsPromises.readFile( packageJSONFile, 'utf-8' ) : '';
  const packageLockContents = fs.existsSync( packageLockFile ) ? await fsPromises.readFile( packageLockFile, 'utf-8' ) : '';

  const hash = crypto.createHash( 'sha256' );
  hash.update( packageJSONContents );
  hash.update( packageLockContents );
  return hash.digest( 'hex' );
};

export const getLatestCommits = async ( repo: Repo, branch: Branch, count: number ): Promise<Commit[]> => {
  const output = await execute( 'git', [
    'log',
    branch,
    '-n',
    `${count}`,
    '--date=iso-strict',
    '--pretty=format:%x1e%H%x1f%h%x1f%an%x1f%ae%x1f%ad%x1f%s'
  ], getRepoDirectory( repo, branch ) );

  return output
    .split( '\x1e' )
    .filter( Boolean )
    .map( line => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [ sha, _, authorName, authorEmail, date, message ] =
        line.split( '\x1f' );
      return {
        sha: sha,
        date: date,
        authorName: authorName,
        authorEmail: authorEmail,
        message: message
      };
    } );
};