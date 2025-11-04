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
import { logger } from './logging.js';
import * as ig from 'isomorphic-git';
// eslint-disable-next-line phet/default-import-match-filename
import igHttp from 'isomorphic-git/http/node';
import { buildLocalObject, config } from './config.js';

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

export const getBranchRootDirectory = ( repo: Repo, branch: Branch ): string => {
  if ( branch === 'main' ) {
    return path.join( ROOT_DIR );
  }
  else {
    return path.join( ROOT_DIR, 'release-branches', `${repo}-${branch}` );
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
  return ig.currentBranch( {
    fs: fs,
    dir: directory
  } ) as Promise<Branch>;
};

export const getDirectorySHA = async ( directory: string ): Promise<SHA> => {
  return ig.resolveRef( {
    fs: fs,
    dir: directory,
    ref: 'HEAD'
  } );
};

export const getDirectoryTimestampBranch = async ( directory: string, branch: Branch ): Promise<number> => {
  const sha = await ig.resolveRef( {
    fs: fs,
    dir: directory,
    ref: branch
  } );

  return ( await ig.readCommit( {
    fs: fs,
    dir: directory,
    oid: sha
  } ) ).commit.committer.timestamp * 1000;
};

export const getCurrentChipperVersion = async (): Promise<ChipperVersion> => {
  return ChipperVersion.getFromPackageJSON(
    JSON.parse( await fsPromises.readFile( `${ROOT_DIR}/chipper/package.json`, 'utf8' ) )
  );
};

export const isDirectoryClean = async ( directory: string ): Promise<boolean> => {
  const matrix = await ig.statusMatrix( {
    fs: fs,
    dir: directory
  } );

  return matrix.every( ( [ , head, workdir, stage ] ) =>
    head === workdir && workdir === stage
  );
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
  const args = getBuildArguments( await getCurrentChipperVersion(), {
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
  else if (
    ( config.gitHttpsUser || buildLocalObject.developerGithubUsername ) &&
    ( config.gitHttpsPassword || buildLocalObject.developerGithubAccessToken )
  ) {
    try {
      const refs = await ig.listServerRefs( {
        http: igHttp,
        url: `https://github.com/${model.repos[ repo ].owner}/${repo === 'perennial-alias' ? 'perennial' : repo}.git`,
        protocolVersion: 2,
        onAuth: () => ( {
          username: config.gitHttpsUser ?? buildLocalObject.developerGithubUsername,
          password: config.gitHttpsPassword ?? buildLocalObject.developerGithubAccessToken
        } )
      } );

      const ref = refs.find( r => r.ref === `refs/heads/${branch}` );
      if ( ref ) {
        return ref.oid;
      }
      else {
        throw new Error( `Branch ${branch} not found for repo ${repo}` );
      }
    }
    catch( e ) {
      console.error( `Error fetching refs for ${repo}: ${e}` );
      throw e;
    }
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
  const igCommits = await ig.log( {
    fs: fs,
    dir: getRepoDirectory( repo, branch ),
    ref: branch,
    depth: count
  } );

  return igCommits.map( commit => {
    return {
      sha: commit.oid,
      date: new Date( commit.commit.committer.timestamp * 1000 ).toISOString(),
      authorName: commit.commit.author.name,
      authorEmail: commit.commit.author.email,
      message: commit.commit.message
    };
  } );
};

export const getLocalesForRepo = async ( repo: Repo ): Promise<string[]> => {
  const locales = [ 'en' ];

  try {
    const babelDir = path.join( ROOT_DIR, 'babel', repo );

    if ( babelDir ) {
      const fileList = await fsPromises.readdir( babelDir );

      for ( const file of fileList ) {
        // Better extract the locale with regex
        const match = file.match( new RegExp( `^${repo}-strings_(.+)\\.json$` ) );
        if ( match && match[ 1 ] ) {
          locales.push( match[ 1 ] );
        }
      }
    }
  }
  catch( e ) {
    logger.warn( `Error getting locales for repo ${repo}: ${e}` );
  }

  locales.sort( ( a, b ) => {
    if ( a === 'en' && b !== 'en' ) {
      return -1;
    }
    else if ( a !== 'en' && b === 'en' ) {
      return 1;
    }
    else {
      return a.localeCompare( b );
    }
  } );

  return locales;
};

export const getAsyncRepoList = async ( name: string ): Promise<Repo[]> => {
  const dataFile = path.join( ROOT_DIR, 'perennial', 'data', name );

  const contents = ( await fsPromises.readFile( dataFile, 'utf8' ) ).trim();

  // Trim will remove any spaces and carriage returns if they are present.
  return contents.split( '\n' ).map( sim => sim.trim() );
};

export const getAsyncActiveRepos = async (): Promise<Repo[]> => getAsyncRepoList( 'active-repos' );
export const getAsyncActiveRunnables = async (): Promise<Repo[]> => getAsyncRepoList( 'active-runnables' );
export const getAsyncActiveSceneryStackRepos = async (): Promise<Repo[]> => getAsyncRepoList( 'active-scenerystack-repos' );
export const getAsyncWrappers = async (): Promise<Repo[]> => getAsyncRepoList( 'wrappers' );