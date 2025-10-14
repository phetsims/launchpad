// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';
import path from 'path';
import fsPromises from 'fs/promises'; // eslint-disable-line phet/default-import-match-filename
import express from 'express';
import http from 'node:http';
import serveIndex from 'serve-index';
import esbuild from 'esbuild';
import crypto from 'crypto';
import os from 'os';
import nopt from 'nopt';
import getActiveRepos from '../../../perennial/js/common/getActiveRepos.js';
import getActiveRunnables from '../../../perennial/js/common/getActiveRunnables.js';
import getActiveSceneryStackRepos from '../../../perennial/js/common/getActiveSceneryStackRepos.js';
import getActiveSims from '../../../perennial/js/common/getActiveSims.js';
import tsxCommand from '../../../perennial/js/common/tsxCommand.js';
import type { Branch, Repo, RepoBranch, RepoListEntry, ModelBranchInfo, SHA, BranchInfo } from '../types/common-types.js';
import pLimit from 'p-limit';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';
import getRemoteBranchSHAs from '../../../perennial/js/common/getRemoteBranchSHAs.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import getFileAtBranch from '../../../perennial/js/common/getFileAtBranch.js';
import npmUpdateDirectory from '../../../perennial/js/common/npmUpdateDirectory.js';
import basicAuth from 'basic-auth';
import ChipperVersion from '../../../perennial/js/common/ChipperVersion.js';
import getBuildArgumentsImport from '../../../perennial/js/common/getBuildArguments.js';
import gruntCommand from '../../../perennial/js/common/gruntCommand.js';

const execute = executeImport.default;
const ReleaseBranch = ReleaseBranchImport.default;
const getBuildArguments = getBuildArgumentsImport.default;

const npmLimit = pLimit( 1 ); // limit npm operations to 1 at a time

( async () => {
  // To do list:
  //
  // - Front-end UI off of scenerystack
  //   - Show BRANCH separation dates for release branches?
  //   - Query parameters: do we scan ALL locations (for dependencies) for query parameters? (initialize-globals, and *QueryParameters?)
  //     -- HAVE a search box for query parameters!
  //     -- BUILD: SHOW whether the sim SHOULD be up-to-date (note that doesn't include babel, so allow builds even if it looks up-to-date)
  //     - Sim-specific query parameters
  //   - Show last commit messages of things?
  //   - TOP-level "most recently updated repos"?
  //   - Links to latest dev/rc versions?
  //   - up/down keys for navigating the repo list?
  //   - get dependency list for each sim, so we can show it (and show updated timestamps for every dependency -- order by timestamp?)
  //   - Dark theme
  // - REST API
  //   - build, sync, status, repo-status, perhaps others?
  //   - Build:
  //     - Allow toggling of "auto build"
  //     - No concurrent builds for the same repo (building multiple sims at a time is fine)
  //     - All brands except for adapted-from-phet (from simPackage.phet?.supportedBrands)
  //     - (and do we skip linting and type-checking?) --- what about uglify?
  //   - Status:
  //     - git-remote-different-repos useful (isGitRemoteDifferent)
  // - serve (and be able to build) release branches also (independent checkouts)
  // - auto-update option implementation (have it work for release branches also)
  // - modulify???
  // - Sync
  //   - first npm-updated chipper, perennial-alias, perennial
  //   - then sync --transpile=true --status=false logPull=false logFormatting=false --npmUpdate=false --checkoutMain=true (????)
  //   - Then check lists?
  // - Test on Windows

  // These will get stat'ed all at once
  const PREFERRED_EXTENSIONS = [ 'js', 'ts' ];

  // These will only be stat'ed if the preferred ones don't exist
  const EXTRA_EXTENSIONS = [ 'tsx', 'jsx', 'mts' ];

  // TODO: don't allow this for production https://github.com/phetsims/phettest/issues/20
  const INCLUDE_CORS_ALL_ORIGINS = true;

  let nextJobID = 0;
  const buildJobs: Record<number, {
    repo: Repo;
    branch: Branch;
    onOutputCallbacks: ( ( str: string ) => void )[];
    onCompletedCallbacks: ( ( success: boolean ) => void )[];
    outputString: string; // Current output so far
    completionState: boolean | null; // null is in progress, otherwise success (true) or failure (false)
  }> = {};
  const updateCheckoutJobs: Record<number, {
    repo: Repo;
    branch: Branch;
    onCompletedCallbacks: ( ( success: boolean ) => void )[];
    completionState: boolean | null; // null is in progress, otherwise success (true) or failure (false)
  }> = {};

  const __filename = fileURLToPath( import.meta.url );
  const __dirname = dirname( __filename );

  const noptOptions = nopt( {}, {}, process.argv, 2 );

  const getOptionIfProvided = <T>( keyName: string, defaultValue?: T ): T => {
    return noptOptions[ keyName ] !== undefined ? noptOptions[ keyName ] : defaultValue!;
  };

  const options = {
    port: getOptionIfProvided( 'port', '45372' ),
    rootDirectory: getOptionIfProvided( 'rootDirectory', resolve( __dirname, '../../..' ) ),
    autoUpdate: getOptionIfProvided( 'autoUpdate', true )
  };

  console.log( 'options:' );
  console.log( ` - port: ${options.port}` );
  console.log( ` - rootDirectory: ${options.rootDirectory}` );
  console.log( ` - autoUpdate: ${options.autoUpdate}` );

  const port = parseInt( options.port, 10 );
  if ( typeof port !== 'number' || isNaN( port ) || port < 0 || port > 65535 ) {
    throw new Error( `Invalid port: ${port}` );
  }

  const ROOT_DIR = options.rootDirectory;
  if ( typeof ROOT_DIR !== 'string' || !fs.existsSync( ROOT_DIR ) || !fs.statSync( ROOT_DIR ).isDirectory() ) {
    throw new Error( `Invalid rootDirectory: ${ROOT_DIR}` );
  }

  type Config = {
    basicAuthUser?: string;
    basicAuthPassword?: string;
  };

  let config: Config = {};
  const configFile = path.join( ROOT_DIR, 'launchpad/config.json' );

  if ( fs.existsSync( configFile ) ) {
    config = JSON.parse( fs.readFileSync( configFile, 'utf8' ) );
  }

  const getRepoDirectory = ( repo: Repo, branch: Branch ): string => {
    if ( branch === 'main' ) {
      return path.join( ROOT_DIR, repo );
    }
    else {
      return path.join( ROOT_DIR, 'release-branches', `${repo}-${branch}`, repo );
    }
  };

  const getDirectoryBranch = async ( directory: string ): Promise<Branch> => {
    return execute( 'git', [ 'symbolic-ref', '-q', 'HEAD' ], directory ).then( stdout => stdout.trim().replace( 'refs/heads/', '' ) );
  };

  const getDirectorySHA = async ( directory: string ): Promise<SHA> => {
    return ( await execute( 'git', [ 'rev-parse', 'HEAD' ], directory ) ).trim();
  };

  const getDirectoryTimestampBranch = async ( directory: string, branch: Branch ): Promise<number> => {
    return execute( 'git', [ 'show', '-s', '--format=%cd', '--date=iso', branch ], directory ).then( stdout => {
      return Promise.resolve( new Date( stdout.trim() ).getTime() );
    } );
  };

  const getCurrentChipperVersion = (): ChipperVersion => {
    return ChipperVersion.getFromPackageJSON(
      JSON.parse( fs.readFileSync( `${ROOT_DIR}/chipper/package.json`, 'utf8' ) )
    );
  };

  const isDirectoryClean = async ( directory: string ): Promise<boolean> => {
    return execute( 'git', [ 'status', '--porcelain' ], directory ).then( stdout => Promise.resolve( stdout.length === 0 ) );
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateReleaseBranchCheckout = async ( releaseBranch: ReleaseBranch ): Promise<void> => {
    return npmLimit( async () => {
      return releaseBranch.updateCheckout();
    } );
  };

  const buildReleaseBranch = async ( releaseBranch: ReleaseBranch, onOutput: ( str: string ) => void ): Promise<void> => {
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

  const buildMain = async ( branchInfo: ModelBranchInfo, onOutput: ( str: string ) => void ): Promise<void> => {
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const updateNodeModules = async ( directory: string ): Promise<void> => {
    return npmLimit( async () => {
      return npmUpdateDirectory( directory );
    } );
  };

  type Model = {
    repos: Record<Repo, {
      name: Repo;
      owner: string;
      isSim: boolean;
      isRunnable: boolean;

      branches: Record<Branch, ModelBranchInfo>;
    }>;
  };

  const getEmptyModel = (): Model => {
    return {
      repos: {}
    };
  };

  const updateModel = async ( model: Model ): Promise<void> => {
    console.log( 'updating model' );

    const activeRepos = getActiveRepos();
    const activeSims = getActiveSims();
    const activeRunnables = getActiveRunnables();
    const sceneryStackRepos = getActiveSceneryStackRepos();

    const repos = [ ...new Set( [
      ...activeRepos,
      ...activeSims,
      ...activeRunnables,
      ...sceneryStackRepos
    ] ) ].sort();

    const existingRepos = Object.keys( model.repos );
    const newRepos = repos.filter( repo => !existingRepos.includes( repo ) );
    const removedRepos = existingRepos.filter( repo => !repos.includes( repo ) );

    const getOwner = ( repo: Repo ): string => {
      return sceneryStackRepos.includes( repo ) ? 'scenerystack' : 'phetsims';
    };
    const isSim = ( repo: Repo ): boolean => {
      return activeSims.includes( repo );
    };
    const isRunnable = ( repo: Repo ): boolean => {
      return activeRunnables.includes( repo );
    };

    const runnableDependenciesMap: Record<Repo, Repo[]> = JSON.parse( await execute( tsxCommand, [ 'js/scripts/print-multiple-dependencies.ts', activeRunnables.join( ',' ) ], path.join( ROOT_DIR, 'chipper' ) ) );

    for ( const newRepo of newRepos ) {
      const packageJSON = isRunnable( newRepo ) ? JSON.parse( fs.readFileSync( path.join( ROOT_DIR, newRepo, 'package.json' ), 'utf-8' ) ) : {};

      model.repos[ newRepo ] = {
        name: newRepo,
        owner: getOwner( newRepo ),
        isSim: isSim( newRepo ),
        isRunnable: isRunnable( newRepo ),
        branches: {
          main: {
            repo: newRepo,
            branch: 'main',

            version: packageJSON.version ?? null,
            phetPackageJSON: packageJSON.phet ?? null,
            brands: [], // will be filled in below
            isReleased: false, // main is never released
            dependencyRepos: [], // will be filled in below

            isCheckedOut: true,
            currentBranch: null, // will be filled in below
            sha: null, // will be filled in below
            timestamp: null, // will be filled in below
            isClean: true, // will be filled in below

            isChipper2: true,
            usesOldPhetioStandalone: false,
            usesRelativeSimPath: true,
            usesPhetioStudio: true,
            usesPhetioStudioIndex: true,

            buildJobID: null,
            lastBuiltTime: null,

            updateCheckoutJobID: null,
            lastUpdatedTime: null,

            npmUpdated: false
          }
        }
      };
    }

    for ( const oldRepo of removedRepos ) {
      delete model.repos[ oldRepo ];
    }
    for ( const repo of repos ) {
      // On the off chance these change
      model.repos[ repo ].owner = getOwner( repo );
      model.repos[ repo ].isSim = isSim( repo );
      model.repos[ repo ].isRunnable = isRunnable( repo );
      model.repos[ repo ].branches.main.dependencyRepos = runnableDependenciesMap[ repo ] || [];

      let brands: string[] = [];
      if ( fs.existsSync( path.join( ROOT_DIR, repo, 'package.json' ) ) ) {
        try {
          const packageJSON = JSON.parse( fs.readFileSync( path.join( ROOT_DIR, repo, 'package.json' ), 'utf8' ) );
          if ( packageJSON.phet && Array.isArray( packageJSON.phet.supportedBrands ) ) {
            brands = packageJSON.phet.supportedBrands.filter( ( brand: string ) => brand !== 'adapted-from-phet' );
          }
        }
        catch( err ) {
          console.warn( `Error reading/parsing package.json for ${repo}: ${err}` );
        }
      }
      model.repos[ repo ].branches.main.brands = brands;
    }

    const limit = pLimit( 15 ); // limit concurrency to avoid excessive resource usage

    console.log( 'scanning main branches/shas' );
    await Promise.all( repos.map( repo => limit( async () => {
      for ( const branch of Object.keys( model.repos[ repo ].branches ) ) {
        if ( model.repos[ repo ].branches[ branch ].isCheckedOut ) {
          const repoDirectory = getRepoDirectory( repo, branch );

          // eslint-disable-next-line require-atomic-updates
          model.repos[ repo ].branches[ branch ].currentBranch = await getDirectoryBranch( repoDirectory );
          // eslint-disable-next-line require-atomic-updates
          model.repos[ repo ].branches[ branch ].sha = await getDirectorySHA( repoDirectory );
          // eslint-disable-next-line require-atomic-updates
          model.repos[ repo ].branches[ branch ].timestamp = await getDirectoryTimestampBranch( repoDirectory, branch );
          // eslint-disable-next-line require-atomic-updates
          model.repos[ repo ].branches[ branch ].isClean = await isDirectoryClean( repoDirectory );
        }
      }
    } ) ) );

    console.log( 'scanning release branches' );
    const releaseBranches = await ReleaseBranch.getAllMaintenanceBranches();

    await Promise.all( releaseBranches.map( releaseBranch => limit( async () => {
      const repo = releaseBranch.repo;
      const branch = releaseBranch.branch;

      if ( !model.repos[ repo ].branches[ branch ] ) {
        const packageJSON = JSON.parse( await getFileAtBranch( repo, branch, 'package.json' ) );

        // eslint-disable-next-line require-atomic-updates
        model.repos[ repo ].branches[ branch ] = {
          repo: repo,
          branch: branch,

          version: packageJSON.version ?? null,
          phetPackageJSON: packageJSON.phet ?? null,
          brands: releaseBranch.brands,
          isReleased: releaseBranch.isReleased,
          dependencyRepos: Object.keys( await releaseBranch.getDependencies() ).filter( name => name !== 'comment' ),

          isCheckedOut: false,
          currentBranch: null,
          sha: null,
          timestamp: null,
          isClean: true,

          isChipper2: await releaseBranch.usesChipper2(),
          usesOldPhetioStandalone: await releaseBranch.usesOldPhetioStandalone(),
          usesRelativeSimPath: await releaseBranch.usesRelativeSimPath(),
          usesPhetioStudio: await releaseBranch.usesPhetioStudio(),
          usesPhetioStudioIndex: await releaseBranch.usesPhetioStudioIndex(),

          buildJobID: null,
          lastBuiltTime: null,

          updateCheckoutJobID: null,
          lastUpdatedTime: null,

          npmUpdated: true // We will handle this manually
        };
      }
    } ) ) );

    console.log( 'finised updating model' );
  };

  const getStaleBranches = async ( model: Model ): Promise<RepoBranch[]> => {
    const repos = Object.keys( model.repos );

    const limit = pLimit( 10 );

    const results: RepoBranch[] = [];

    await Promise.all( repos.map( repo => limit( async () => {
      const branchSHAs = await getRemoteBranchSHAs( repo );

      const branches = Object.keys( model.repos[ repo ].branches );

      for ( const branch of branches ) {
        if ( model.repos[ repo ].branches[ branch ].isCheckedOut ) {
          const localSHA = model.repos[ repo ].branches[ branch ].sha;
          const remoteSHA = branchSHAs[ branch ];

          if ( localSHA && remoteSHA && localSHA !== remoteSHA ) {
            console.log( repo, branch, 'is stale', localSHA, remoteSHA );
            results.push( { repo: repo, branch: branch } );
          }
        }
      }
    } ) ) );

    return results;
  };

  const model = fs.existsSync( '.model.json' ) ? JSON.parse( fs.readFileSync( '.model.json', 'utf8' ) ) as Model : getEmptyModel();

  // Reset some state on startup
  for ( const repo of Object.keys( model.repos ) ) {
    for ( const branch of Object.keys( model.repos[ repo ].branches ) ) {
      model.repos[ repo ].branches[ branch ].buildJobID = null; // reset any in-progress builds
    }
  }

  const saveModel = () => {
    fs.writeFileSync( '.model.json', JSON.stringify( model, null, 2 ), 'utf8' );
  };

  await updateModel( model );
  ( async () => {
    console.log( await getStaleBranches( model ) );
  } )().catch( e => { throw e; } );
  saveModel();

  type JSCacheEntry = {
    mtime: number;
    size: number;
    etag: string;
    contents: string;
  };

  const jsCache = new Map<string, JSCacheEntry>();

  const getWeakEtag = ( mtime: number, size: number ): string => {
    return `W/"${size}-${Math.trunc( mtime )}"`; // weak is fine
  };

  const getStrongEtag = ( input: string, algorithm: 'sha1' | 'sha256' | 'md5' = 'sha256' ): string => {
    return `"${algorithm}-${crypto.createHash( algorithm ).update( input ).digest( 'base64' )}"`;
  };

  const conditionalStat = async ( filePath: string ): Promise<fs.Stats | null> => {
    try {
      return await fsPromises.stat( filePath );
    }
    catch( e ) {
      return null;
    }
  };

  const conditionalStatExtensionMap = async ( filePath: string, extensions: string[] ): Promise<Record<string, fs.Stats | null>> => {
    const result: Record<string, fs.Stats | null> = {};

    await Promise.all( extensions.map( async extension => {
        result[ extension ] = await conditionalStat( path.join( ROOT_DIR, filePath + '.' + extension ) );
    } ) );

    return result;
  };

  const getStatWithExtension = async ( filePath: string ): Promise<{ stat: fs.Stats; extension: string } | null> => {
    const preferredStatMap = await conditionalStatExtensionMap( filePath, PREFERRED_EXTENSIONS );

    for ( const extension of PREFERRED_EXTENSIONS ) {
      const stat = preferredStatMap[ extension ];
      if ( stat ) {
        return { stat: stat, extension: extension };
      }
    }

    const extraStatMap = await conditionalStatExtensionMap( filePath, EXTRA_EXTENSIONS );

    for ( const extension of EXTRA_EXTENSIONS ) {
      const stat = extraStatMap[ extension ];
      if ( stat ) {
        return { stat: stat, extension: extension };
      }
    }

    return null;
  };


  // --- esbuild Plugins (Hacks) ---
  const simLauncherRewrite: esbuild.Plugin = {
    name: 'simLauncher-rewrite',
    setup( build ) {
      build.onLoad( { filter: /simLauncher.ts$/ }, async ( { path } ) => {
        let text = await fsPromises.readFile( path, 'utf8' );
        text = text.replace( '\'js\'', '\'ts\'' );
        return { contents: text, loader: 'ts' };
      } );
    }
  };

  const himalayaRewrite: esbuild.Plugin = {
    name: 'himalaya-rewrite',
    setup( build ) {
      build.onLoad( { filter: /himalaya-1.1.0.js$/ }, async ( { path } ) => {
        const originalText = await fsPromises.readFile( path, 'utf8' );
        const text = originalText.replace(
          '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.himalaya = f()}})',
          '( function( f ) {self.himalaya = f();})'
        );
        if ( text === originalText ) {
          throw new Error( 'himalaya rewrite failed?' );
        }
        return { contents: text, loader: 'js' };
      } );
    }
  };

  const peggyRewrite: esbuild.Plugin = {
    name: 'peggy-rewrite',
    setup( build ) {
      build.onLoad( { filter: /peggy-3.0.2.js$/ }, async ( { path } ) => {
        let text = await fsPromises.readFile( path, 'utf8' );
        text = text.replace(
          'function(e,u){"object"==typeof exports&&"undefined"!=typeof module?module.exports=u():"function"==typeof define&&define.amd?define(u):(e="undefined"!=typeof globalThis?globalThis:e||self).peggy=u()}'.replaceAll( '\n', os.EOL ),
          '( function( e,u ) {self.peggy = u();})'
        );
        return { contents: text, loader: 'js' };
      } );
    }
  };

  // Bundles a TS (or JS) entry point using esbuild, throws an error on failure.
  const bundleFile = async ( filePath: string, originalPathname: string ): Promise<string> => {
    try {
      const result = await esbuild.build( {
        entryPoints: [ filePath ],
        bundle: true,
        format: 'esm',
        minify: true,
        write: false, // We handle writing/sending the response
        sourcemap: 'inline', // Keep source maps inline for dev
        plugins: [ simLauncherRewrite, himalayaRewrite, peggyRewrite ],
        absWorkingDir: ROOT_DIR // Needed to resolve files relative to the entry point's directory
      } );
      const output = result.outputFiles[ 0 ];

      return output.text;
    }
    catch( err: unknown ) {
      console.error( 'Esbuild bundling error:', err );
      throw err;
    }
  };

  // Transpiles a single TS file in-memory, throws an error on failure.
  const transpileTS = async ( tsCode: string, filePath: string, originalPathname: string ): Promise<string> => {
    try {
      const loader = filePath.endsWith( 'tsx' ) ? 'tsx' :
                     filePath.endsWith( 'jsx' ) ? 'jsx' :
                     'ts';
      const result = await esbuild.transform( tsCode, {
        loader: loader,
        format: 'esm', // Output ESM
        sourcemap: 'inline', // Keep source maps inline for dev
        target: 'esnext' // Use modern JS features
      } );

      return result.code;
    }
    catch( err: unknown ) {
      console.error( 'Esbuild transform error:', err );
      throw err;
    }
  };

  const app = express();

  // Global cache-control and authentication
  app.use( ( req, res, next ) => {

    if ( config.basicAuthUser && config.basicAuthPassword ) {
      const credentials = basicAuth( req );

      if ( !credentials || credentials.name !== config.basicAuthUser || credentials.pass !== config.basicAuthPassword ) {
        res.statusCode = 401;
        res.setHeader( 'WWW-Authenticate', 'Basic realm="launchpad"' );
        res.end( 'Access denied' );
        return;
      }
    }

    res.setHeader( 'Cache-Control', 'public, max-age=0, must-revalidate' );

    if ( INCLUDE_CORS_ALL_ORIGINS ) {
      res.setHeader( 'Access-Control-Allow-Origin', '*' );
    }

    next();
  } );

  app.get( '/api/repo-list', async ( req, res, next ) => {
    res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );

    res.send( JSON.stringify( {
      repoList: Object.keys( model.repos ).map( repo => {
        const repoListEntry: RepoListEntry = {
          name: repo,
          owner: model.repos[ repo ].owner,
          isSim: model.repos[ repo ].isSim,
          isRunnable: model.repos[ repo ].isRunnable,
          branches: Object.keys( model.repos[ repo ].branches )
        };

        return repoListEntry;
      } )
    } ) );
  } );

  app.get( /\/api\/branch-info\/([^/]+)\/([^/]+)$/, async ( req, res, next ) => {
    const repo = req.params[ 0 ];
    const branch = req.params[ 1 ];

    if ( !model.repos[ repo ] ) {
      res.status( 404 ).send( `Unknown repo: ${repo}` );
    }
    else if ( !model.repos[ repo ].branches[ branch ] ) {
      res.status( 404 ).send( `Unknown branch: ${branch} for repo ${repo}` );
    }
    else {
      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );

      const dependencySHAMap: Record<Repo, SHA> = {};
      const dependencyTimestampMap: Record<Repo, number> = {};

      for ( const dependencyRepo of model.repos[ repo ].branches[ branch ].dependencyRepos ) {
        dependencySHAMap[ dependencyRepo ] = model.repos[ dependencyRepo ].branches.main.sha!;
        dependencyTimestampMap[ dependencyRepo ] = model.repos[ dependencyRepo ].branches.main.timestamp!;
      }

      const result: BranchInfo = {
        // eslint-disable-next-line phet/no-object-spread-on-non-literals
        ...model.repos[ repo ].branches[ branch ],
        dependencySHAMap: dependencySHAMap,
        dependencyTimestampMap: dependencyTimestampMap
      };

      res.send( JSON.stringify( result ) );
    }
  } );

  // TODO: move the build job logic to another file
  app.post( '/api/build/:repo/:branch', async ( req, res, next ) => {
    const repo = req.params.repo;
    const branch = req.params.branch;

    const branchInfo = model.repos[ repo ]?.branches[ branch ];
    if ( !branchInfo ) {
      res.status( 404 ).send( `Unknown repo/branch: ${repo}/${branch}` );
      return;
    }

    if ( branchInfo.buildJobID !== null ) {
      console.log( 'Already building', repo, branch, branchInfo.buildJobID );

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        buildJobID: branchInfo.buildJobID
      } ) );
    }
    else {
      const buildJobID = nextJobID++;

      branchInfo.buildJobID = buildJobID;
      branchInfo.lastBuiltTime = null;
      saveModel();

      buildJobs[ buildJobID ] = {
        repo: repo,
        branch: branch,
        onOutputCallbacks: [],
        onCompletedCallbacks: [],
        outputString: '',
        completionState: null
      };

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        buildJobID: branchInfo.buildJobID
      } ) );

      const onOutput = ( str: string ) => {
        console.log( str.split( '\n' ).map( line => `  [build job ${buildJobID}] ${line}` ).join( '\n' ) );
        buildJobs[ buildJobID ].outputString += str;
        buildJobs[ buildJobID ].onOutputCallbacks.forEach( callback => callback( str ) );
      };
      const onCompleted = ( success: boolean ) => {
        buildJobs[ buildJobID ].completionState = success;
        buildJobs[ buildJobID ].onCompletedCallbacks.forEach( callback => callback( success ) );
      };
      try {
        console.log( `Starting build job ${buildJobID} for ${repo}/${branch}` );

        if ( branch === 'main' ) {
          await buildMain( branchInfo, onOutput );
        }
        else {
          await buildReleaseBranch( new ReleaseBranch( repo, branch, branchInfo.brands, branchInfo.isReleased ), onOutput );
        }

        console.log( `Build job ${buildJobID} for ${repo}/${branch} completed successfully` );

        onCompleted( true );

        // TODO: improved persistence model
        // Only set this on success
        branchInfo.lastBuiltTime = Date.now();
        saveModel();
      }
      catch( e ) {
        console.log( `Build job ${buildJobID} for ${repo}/${branch} failed: ${e}` );

        onOutput( `Build error: ${e}\n` );
        onCompleted( false );
      }
      finally {
        buildJobs[ buildJobID ].onOutputCallbacks = [];
        buildJobs[ buildJobID ].onCompletedCallbacks = [];

        branchInfo.buildJobID = null;
        saveModel();
      }
    }
  } );

  app.get( '/api/build-events/:id', async ( req, res, next ) => {
    const id = Number.parseInt( req.params.id, 10 );

    const buildJob = buildJobs[ id ];
    if ( !buildJob ) {
      res.status( 404 ).send( `Unknown build job: ${id}` );
      return;
    }

    req.socket.setTimeout( 0 ); // Keep connection open
    res.writeHead( 200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no' // for nginx
    } );

    const outputCallback = ( str: string ) => {
      res.write( `data: ${JSON.stringify( {
        type: 'output',
        text: str
      } )}\n\n` );
    };
    const completedCallback = ( success: boolean ) => {
      res.write( `data: ${JSON.stringify( {
        type: 'completed',
        success: success
      } )}\n\n` );
      res.end();
    };

    buildJob.onOutputCallbacks.push( outputCallback );
    buildJob.onCompletedCallbacks.push( completedCallback );

    const ping = setInterval( () => res.write( ': ping\n\n' ), 15000 );

    req.on( 'close', () => {
      clearInterval( ping );
      buildJob.onOutputCallbacks = buildJob.onOutputCallbacks.filter( callback => callback !== outputCallback );
      buildJob.onCompletedCallbacks = buildJob.onCompletedCallbacks.filter( callback => callback !== completedCallback );
    } );

    if ( buildJob.outputString.length > 0 ) {
      outputCallback( buildJob.outputString );
    }
    if ( buildJob.completionState !== null ) {
      completedCallback( buildJob.completionState );
    }
  } );

  // For updating checkouts
  app.post( '/api/update/:repo/:branch', async ( req, res, next ) => {
    const repo = req.params.repo;
    const branch = req.params.branch;

    const branchInfo = model.repos[ repo ]?.branches[ branch ];
    if ( !branchInfo ) {
      res.status( 404 ).send( `Unknown repo/branch: ${repo}/${branch}` );
      return;
    }

    if ( branchInfo.updateCheckoutJobID !== null ) {
      console.log( 'Already updating', repo, branch, branchInfo.updateCheckoutJobID );

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        updateCheckoutJobID: branchInfo.updateCheckoutJobID
      } ) );
    }
    else {
      const updateCheckoutJobID = nextJobID++;

      branchInfo.updateCheckoutJobID = updateCheckoutJobID;
      branchInfo.lastUpdatedTime = null;
      branchInfo.isCheckedOut = false;
      saveModel();

      updateCheckoutJobs[ updateCheckoutJobID ] = {
        repo: repo,
        branch: branch,
        onCompletedCallbacks: [],
        completionState: null
      };

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        updateCheckoutJobID: branchInfo.updateCheckoutJobID
      } ) );

      const onCompleted = ( success: boolean ) => {
        updateCheckoutJobs[ updateCheckoutJobID ].completionState = success;
        updateCheckoutJobs[ updateCheckoutJobID ].onCompletedCallbacks.forEach( callback => callback( success ) );
      };
      try {
        console.log( `Starting update checkout job ${updateCheckoutJobID} for ${repo}/${branch}` );

        let success = true;
        try {
          await updateReleaseBranchCheckout( new ReleaseBranch( repo, branch, branchInfo.brands, branchInfo.isReleased ) );
        }
        catch( e ) {
          success = false;
          console.log( `Update checkout job ${updateCheckoutJobID} for ${repo}/${branch} failed: ${e}` );
        }

        onCompleted( success );

        if ( success ) {
          branchInfo.lastUpdatedTime = Date.now();
          branchInfo.isCheckedOut = true;
          saveModel();
        }
      }
      finally {
        updateCheckoutJobs[ updateCheckoutJobID ].onCompletedCallbacks = [];

        branchInfo.updateCheckoutJobID = null;
        saveModel();
      }
    }
  } );

  app.get( '/api/update-events/:id', async ( req, res, next ) => {
    const id = Number.parseInt( req.params.id, 10 );

    const updateCheckoutJob = updateCheckoutJobs[ id ];
    if ( !updateCheckoutJob ) {
      res.status( 404 ).send( `Unknown update checkout job: ${id}` );
      return;
    }

    req.socket.setTimeout( 0 ); // Keep connection open
    res.writeHead( 200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no' // for nginx
    } );

    const completedCallback = ( success: boolean ) => {
      res.write( `data: ${JSON.stringify( {
        type: 'completed',
        success: success
      } )}\n\n` );
      res.end();
    };

    updateCheckoutJob.onCompletedCallbacks.push( completedCallback );

    const ping = setInterval( () => res.write( ': ping\n\n' ), 15000 );

    req.on( 'close', () => {
      clearInterval( ping );
      updateCheckoutJob.onCompletedCallbacks = updateCheckoutJob.onCompletedCallbacks.filter( callback => callback !== completedCallback );
    } );

    if ( updateCheckoutJob.completionState !== null ) {
      completedCallback( updateCheckoutJob.completionState );
    }
  } );

  app.get( /^\/(.+)\.js$/, async ( req, res, next ) => {
    try {
      const key = req.params[ 0 ].replace( 'chipper/dist/js/', '' ).replace( /^\/+/, '' );
      const reqPath = req.path.replace( 'chipper/dist/js/', '' );

      const statWithExtension = await getStatWithExtension( key );

      if ( statWithExtension ) {
        const stat = statWithExtension.stat;
        const extension = statWithExtension.extension;
        const pathWithExtension = path.join( ROOT_DIR, key + '.' + extension );
        const isJS = extension === 'js';
        const isEntryPoint = key.endsWith( '-main' ) || key.endsWith( '-tests' );

        const cacheEntry = jsCache.get( key );

        const singleFileEtag = getWeakEtag( stat.mtimeMs, stat.size );

        if ( !isEntryPoint ) {
          res.setHeader( 'ETag', singleFileEtag );
        }
        res.setHeader( 'Last-Modified', new Date( stat.mtimeMs ).toUTCString() );
        res.setHeader( 'Content-Type', 'application/javascript; charset=utf-8' );
        // res.setHeader( 'Cache-Control', 'public, max-age=0, must-revalidate' );

        // Give a quick 304 if possible
        if ( !isEntryPoint && req.headers[ 'if-none-match' ] === singleFileEtag ) {
          res.status( 304 ).end();
        }
        // Or a cache hit if we've already transpiled it
        else if (
          !isEntryPoint &&
          cacheEntry &&
          cacheEntry.mtime === stat.mtimeMs &&
          cacheEntry.size === stat.size
        ) {
          res.send( cacheEntry.contents );
        }
        else if ( !isEntryPoint ) {
          const originalSource = await fsPromises.readFile( pathWithExtension, 'utf8' );

          const finalSource = isJS ? originalSource : await transpileTS( originalSource, pathWithExtension, reqPath );

          jsCache.set( key, { mtime: stat.mtimeMs, size: stat.size, etag: singleFileEtag, contents: finalSource } );

          res.send( finalSource );
        }
        else {
          const finalSource = await bundleFile( pathWithExtension, reqPath );

          const etag = getStrongEtag( finalSource );

          res.setHeader( 'ETag', etag );

          if ( req.headers[ 'if-none-match' ] === etag ) {
            res.status( 304 ).end();
          }
          else {
            // TODO: no cache... right? unless we could determine all of the files used? Would esbuild let us get that out? https://github.com/phetsims/phettest/issues/20

            res.send( finalSource );
          }
        }
      }
      else {
        next();
      }
    }
    catch( e ) {
      next( e );
    }
  } );

  // Static hosting for other files
  app.use( express.static( ROOT_DIR, {
    etag: true
  } ) );

  // Static hosting for launchpad build
  app.use( express.static( `${ROOT_DIR}/launchpad/dist`, {
    etag: true
  } ) );

  // If static didn't find a file (esp. index.html in a dir), serveIndex will check if it's a directory and list contents.
  app.use( serveIndex( ROOT_DIR, { icons: true } ) ); // Optional: adds icons

  const server = http.createServer( app );

  // Handle server errors (e.g., port already in use)
  server.on( 'error', ( err: Error ) => {
    if ( err.message.includes( 'EADDRINUSE' ) ) {
      console.error( `Error: Port ${options.port} is already in use. Try specifying a different port with --port=NUMBER` );
    }
    else {
      console.error( 'Server startup error:', err );
    }
    process.exit( 1 );
  } );

  server.listen( options.port, () => {
    console.log( `Phettest Server listening at http://localhost:${options.port}/` );
    console.log( `Serving files from: ${ROOT_DIR}` );
  } );

  // catching signals for log before exiting (useful for pm2 restarting)
  [ 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1',
    'SIGSEGV', 'SIGUSR2', 'SIGTERM', 'beforeExit', 'uncaughtException', 'unhandledRejection'
  ].forEach( sig => process.on( sig, ( error: Error ) => {
    console.log( `exiting from ${sig}`, error );
    process.exit( 1 );
  } ) );
} )().catch( e => { throw e; } );