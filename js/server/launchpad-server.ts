// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises'; // eslint-disable-line phet/default-import-match-filename
import express, { NextFunction, Request, Response } from 'express';
import http from 'node:http';
import serveIndex from 'serve-index';
import crypto from 'crypto';
import type { Branch, BranchInfo, LogEvent, ModelBranchInfo, Repo, RepoListEntry, SHA } from '../types/common-types.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import basicAuth from 'basic-auth';
import { config } from './config.js';
import { model, saveModel } from './model.js';
import { autoBuild, autoUpdate, numAutoBuildThreads, port, ROOT_DIR } from './options.js';
import { buildMain, buildReleaseBranch, getLatestCommits, getLatestSHA, getNPMHash, updateMain, updateReleaseBranchCheckout } from './util.js';
import { getQueryParameters, recomputeNodeModules, singlePassUpdate, updateModel, updateModelBranchInfo, updateNodeModules } from './updateModel.js';
import { bundleFile, transpileTS } from './bundling.js';
import sleep from '../../../perennial/js/common/sleep.js';
import { addLogCallback, lastErrorLogEvents, lastWarnLogEvents, logger, removeLogCallback } from './logging.js';
import getRepoList from '../../../perennial/js/common/getRepoList.js';

const ReleaseBranch = ReleaseBranchImport.default;

( async () => {
  /*
   * TO DO bugs:
   *  - Log button crash - memory?
   *
   * TO DO features:
   *  - Write out power-user features in Settings UI (or an info button) (have a pop-up for it?)
   *  - BUILT wrappers (for the "wrappers" list)
   *    - THEN remove the "index" since it would be the default wrapper
   *  -- Wrapper index as "wrappers" -- but then radio button to select other wrappers
   *  -- Power shortcut for build/no-build
   *    - Perhaps we should default to non-built
   *  - Query Parameters!
   *    - Include sim-specific query parameters --- auto-scan all files?
   *    - Query parameters: do we scan ALL locations (for dependencies) for query parameters? (initialize-globals, and *QueryParameters?)
   *      -- HAVE a search box for query parameters!
   *      -- BUILD: SHOW whether the sim SHOULD be up-to-date (note that doesn't include babel, so allow builds even if it looks up-to-date)
   *    - Include (and detect) locale query parameter translated locales
   *    - Wrappers query parameters
   *  - TOASTS for when repos are updated (perhaps show commit info too) --- i.e. popups that show live updates
   *    - Perhaps show a list of recently discovered updates --- server-side query list?
   *  - LOG usability (right now seems tricky) - at least test main server-side)
   *  - Modulify - LIVE MODULIFY preferred, but can auto-modulify otherwise
   *  - Unbuilt release branches (they are buggy right now)
   *  - Test on Windows
   *  - Package Lock handling
   *  - Move over more phetmarks links (e.g. phet-io links that are missing - talk to MK)
   *    - UNBUILT and BUILT index!!! This is this primary thing
   *    - Migration and State are the two main things I'm missing
   *    - Have a "wrappers"
   *  - Better a11y for lists (have the arrows handle first list, can tab to second, etc.) -- e.g. group selection
   *  - Clearer copy-to-clipboard (or just... make links) - copy icon or buttons?
   *  - "Advanced" button to trigger updateModel server-side?
   *    - WE MIGHT NEED A LOCK
   *  - Search that can find modes (see if we can match two levels with the search) -- for modes that exist in one repo
   *
   * TO DO internal:
   *  - Persistence and saveModel usage is a mess (server-side)
   *
   * TO DO performance:
   *  - Reduce file sizes --- they are pretty big, especially with the source map inline
   *
   * Deferred performance:
   *  - Octokit remote operations (due to worries about rate limits)
   *  - GitHub webhooks - could set organization-wide hooks, and have launchpad listen for updates
   *
   * Deferred features:
   *  - Non-PhET-member handling (private repos shouldn't be pulled, etc.)
   *  - More customization on what features to show/hide
   *  - Preview of URL that will be launched
   *  - Emails or slack notifications on errors
   *  - "Sync" button for local non-auto-update development?
   *    - Or allow client to control server auto-update?
   *      - first npm-updated chipper, perennial-alias, perennial
   *      - then sync --transpile=true --status=false logPull=false logFormatting=false --npmUpdate=false --checkoutMain=true (????)
   *      - Then check lists?
   *  - per-main-repo LOCKS for git mutating commands (includes getFileAtBranch... unfortunately)
   */

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
  const updateJobs: Record<number, {
    repo: Repo;
    branch: Branch;
    onCompletedCallbacks: ( ( success: boolean ) => void )[];
    completionState: boolean | null; // null is in progress, otherwise success (true) or failure (false)
  }> = {};

  await updateModel( model );

  // TODO: move the build job logic to another file https://github.com/phetsims/phettest/issues/20
  const runBuildJob = async (
    branchInfo: ModelBranchInfo,
    buildJobID: number
  ) => {

    const repo = branchInfo.repo;
    const branch = branchInfo.branch;

    if ( branchInfo.buildJobID !== null ) {
      throw new Error( `Branch ${branchInfo.repo}/${branchInfo.branch} is already being built` );
    }

    if ( branch === 'main' && branchInfo.currentBranch !== null && branchInfo.currentBranch !== 'main' ) {
      logger.warn( 'Skipping build of main branch when a release branch is checked out' );
      return;
    }

    branchInfo.buildJobID = buildJobID;
    branchInfo.lastBuiltTime = null;
    branchInfo.lastBuildSHAs = {};
    saveModel();

    buildJobs[ buildJobID ] = {
      repo: repo,
      branch: branch,
      onOutputCallbacks: [],
      onCompletedCallbacks: [],
      outputString: '',
      completionState: null
    };

    const onOutput = ( str: string ) => {
      str.split( '\n' ).forEach( line => {
        logger.verbose( `  [build job ${buildJobID} ${repo} ${branch}] ${line}` );
      } );
      buildJobs[ buildJobID ].outputString += str;
      buildJobs[ buildJobID ].onOutputCallbacks.forEach( callback => callback( str ) );
    };
    const onCompleted = ( success: boolean ) => {
      buildJobs[ buildJobID ].completionState = success;
      buildJobs[ buildJobID ].onCompletedCallbacks.forEach( callback => callback( success ) );
    };
    try {
      logger.verbose( `Starting build job ${buildJobID} for ${repo}/${branch}` );

      const lastBuildSHAs: Record<Repo, SHA> = {};

      if ( branch === 'main' ) {
        for ( const dependencyRepo of branchInfo.dependencyRepos ) {
          lastBuildSHAs[ dependencyRepo ] = model.repos[ dependencyRepo ].branches.main.sha!;
        }
        await buildMain( branchInfo, onOutput );
      }
      else {
        lastBuildSHAs[ repo ] = model.repos[ repo ].branches[ branch ].sha!;
        await buildReleaseBranch( new ReleaseBranch( repo, branch, branchInfo.brands, branchInfo.isReleased ), onOutput );
      }

      logger.verbose( `Build job ${buildJobID} for ${repo}/${branch} completed successfully` );

      onCompleted( true );

      // TODO: improved persistence model https://github.com/phetsims/phettest/issues/20
      // Only set this on success
      // eslint-disable-next-line require-atomic-updates
      branchInfo.lastBuiltTime = Date.now();
      // eslint-disable-next-line require-atomic-updates
      branchInfo.lastBuildSHAs = lastBuildSHAs;
      saveModel();
    }
    catch( e ) {
      logger.warn( `Build job ${buildJobID} for ${repo}/${branch} failed: ${e}` );

      onOutput( `Build error: ${e}\n` );
      onCompleted( false );
    }
    finally {
      buildJobs[ buildJobID ].onOutputCallbacks = [];
      buildJobs[ buildJobID ].onCompletedCallbacks = [];

      // eslint-disable-next-line require-atomic-updates
      branchInfo.buildJobID = null;
      saveModel();
    }
  };

  const updateBranch = async (
    branchInfo: ModelBranchInfo,
    updateJobID: number
  ) => {
    if ( branchInfo.updateJobID !== null ) {
      throw new Error( `Branch ${branchInfo.repo}/${branchInfo.branch} is already being updated` );
    }

    const repo = branchInfo.repo;
    const branch = branchInfo.branch;

    if ( branch === 'main' && branchInfo.currentBranch !== null && branchInfo.currentBranch !== 'main' ) {
      logger.warn( `Skipping update of main branch when a release branch is checked out: ${repo}/${branch}` );
      return;
    }

    branchInfo.updateJobID = updateJobID;
    branchInfo.lastUpdatedTime = null;
    if ( branch !== 'main' ) {
      branchInfo.isCheckedOut = false;
    }
    saveModel();

    updateJobs[ updateJobID ] = {
      repo: repo,
      branch: branch,
      onCompletedCallbacks: [],
      completionState: null
    };

    const onCompleted = ( success: boolean ) => {
      updateJobs[ updateJobID ].completionState = success;
      updateJobs[ updateJobID ].onCompletedCallbacks.forEach( callback => callback( success ) );
    };
    try {
      logger.info( `Starting update job ${updateJobID} for ${repo}/${branch}` );

      let success = true;
      try {
        if ( branch === 'main' ) {
          const hashBefore = getNPMHash( repo );

          await updateMain( repo );

          const hashAfter = getNPMHash( repo );

          if ( hashBefore !== hashAfter ) {
            ( async () => {
              await recomputeNodeModules( model, repo );
            } )().catch( e => logger.error( `async recomputeNodeModules error ${repo}: ${e}` ) );
          }
        }
        else {
          await updateReleaseBranchCheckout( new ReleaseBranch( repo, branch, branchInfo.brands, branchInfo.isReleased ) );
        }

        logger.info( `Update job ${updateJobID} for ${repo}/${branch} completed successfully` );
      }
      catch( e ) {
        success = false;
        logger.info( `Update job ${updateJobID} for ${repo}/${branch} failed: ${e}` );
      }

      if ( success ) {
        // eslint-disable-next-line require-atomic-updates
        branchInfo.lastUpdatedTime = Date.now();

        if ( branch !== 'main' ) {
          // eslint-disable-next-line require-atomic-updates
          branchInfo.isCheckedOut = true;
        }

        await updateModelBranchInfo( branchInfo );

        saveModel();
      }

      onCompleted( success );
    }
    finally {
      updateJobs[ updateJobID ].onCompletedCallbacks = [];

      // eslint-disable-next-line require-atomic-updates
      branchInfo.updateJobID = null;
      saveModel();
    }

    // Trigger an updateModel immediately after a perennial update
    if ( repo === 'perennial' ) {
      ( async () => {
        await updateModel( model );
      } )().catch( e => logger.error( `async updateModel after perennial update error: ${e}` ) );
    }
  };

  // Kick off initial node_modules updates
  ( async () => {
    for ( const repo of Object.keys( model.repos ) ) {
      if ( !model.repos[ repo ].branches.main.npmUpdated ) {
        await updateNodeModules( model, repo );
        saveModel();
      }
    }
  } )().catch( e => logger.error( `initial nodeModules update error: ${e}` ) );

  if ( autoUpdate ) {
    ( async () => {
      while ( true ) {
        logger.debug( 'Starting auto-update iteration' );

        try {
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          await singlePassUpdate( model, branchInfo => updateBranch( branchInfo, nextJobID++ ) );
        }
        catch( e ) {
          logger.error( `Auto-update iteration failed: ${e}` );
        }
      }
    } )().catch( e => logger.error( `auto update failure: ${e}` ) );
  }

  if ( autoBuild ) {
    for ( let i = 0; i < numAutoBuildThreads; i++ ) {
      // eslint-disable-next-line @typescript-eslint/no-loop-func
      ( async () => {
        while ( true ) {

          logger.debug( 'Starting auto-build iteration' );

          for ( const repo of Object.keys( model.repos ) ) {
            if ( model.repos[ repo ].isRunnable ) {
              for ( const branch of Object.keys( model.repos[ repo ].branches ) ) {
                try {
                  const branchInfo = model.repos[ repo ].branches[ branch ];

                  if ( branchInfo.isCheckedOut && branchInfo.buildJobID === null && branchInfo.npmUpdated ) {
                    let outOfDate = branchInfo.lastBuiltTime === null;

                    for ( const dependencyRepo of branchInfo.dependencyRepos ) {
                      const dependencySHA = model.repos[ dependencyRepo ].branches.main.sha;
                      const lastBuildSHA = branchInfo.lastBuildSHAs[ dependencyRepo ];

                      if ( dependencySHA !== lastBuildSHA ) {
                        outOfDate = true;
                      }
                    }

                    if ( outOfDate ) {
                      logger.debug( `Auto-building ${repo}/${branch}` );
                      await runBuildJob( branchInfo, nextJobID++ );
                    }
                    else {
                      logger.debug( `Skipping autobuild for ${repo}/${branch}, up-to-date` );
                    }
                  }
                  else {
                    logger.debug( `Skipping autobuild for ${repo}/${branch}`, branchInfo.isCheckedOut, branchInfo.buildJobID, branchInfo.npmUpdated );
                  }
                }
                catch( e ) {
                  logger.error( `autoBuild error for ${repo}/${branch}: ${e}` );
                }
              }
            }
          }

          await sleep( 3000 ); // prevent tight loop if there is nothing to build
        }
      } )().catch( e => logger.error( `async autoBuild error: ${e}` ) );
    }
  }

  ( async () => {
    while ( true ) {
      await sleep( 10 * 60 * 1000 ); // every 10 minutes

      try {
        logger.debug( 'Starting periodic updateModel' );

        await updateModel( model );
      }
      catch( e ) {
        logger.error( `Periodic updateModel error: ${e}` );
      }
    }
  } )().catch( e => logger.error( `updateModel global error: ${e}` ) );

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

  const safeConditionalStat = async (
    filePath: string,
    extension: string
  ): Promise<fs.Stats | null> => {
    try {
      // Handle bad characters
      // eslint-disable-next-line no-control-regex
      if ( /[\0-\x1F]/.test( filePath ) || filePath.includes( '%' ) ) {
        logger.debug( `Rejected filePath with bad characters: ${filePath}` );
        return null;
      }

      // Normalize slashes and validate segments
      const segments = filePath.replace( /\\/g, '/' ).split( '/' ).filter( Boolean );
      if ( segments.length === 0 ) {
        logger.debug( `Rejected empty filePath: ${filePath}` );
        return null;
      }

      for ( const segment of segments ) {
        if (
          segment === '.' ||
          segment === '..' ||
          !/^[A-Za-z0-9._\-]+$/.test( segment ) // TODO: is this too restrictive?
        ) {
          logger.debug( `Rejected filePath with invalid segment: ${filePath}` );
          return null;
        }
      }

      const sanitizedPath = segments.join( '/' );
      const fullPath = path.resolve( ROOT_DIR, sanitizedPath + '.' + extension );
      const basePath = path.resolve( ROOT_DIR );

      if ( !fullPath.startsWith( basePath + path.sep ) && fullPath !== basePath ) {
        logger.debug( `Rejected filePath outside ROOT_DIR: ${filePath}` );
        return null;
      }

      return await fsPromises.stat( fullPath ).catch( () => null );
    }
    catch( e ) {
      return null;
    }
  };

  const conditionalStatExtensionMap = async ( filePath: string, extensions: string[] ): Promise<Record<string, fs.Stats | null>> => {
    const result: Record<string, fs.Stats | null> = {};

    await Promise.all( extensions.map( async extension => {
      result[ extension ] = await safeConditionalStat( filePath, extension );
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

  const app = express();

  app.use( ( req, res, next ) => {
    logger.silly( `url: ${req.originalUrl}` );
    next();
  } );

  // Global cache-control and authentication
  app.use( ( req: Request, res: Response, next: NextFunction ) => {
    try {
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
      res.setHeader( 'X-Launchpad', 'Launchpad' );

      if ( INCLUDE_CORS_ALL_ORIGINS ) {
        res.setHeader( 'Access-Control-Allow-Origin', '*' );
      }

      next();
    }
    catch( e ) {
      console.error( `Error in global middleware: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/repo-list', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );

      res.send( JSON.stringify( {
        repoList: Object.keys( model.repos ).sort().map( repo => {
          const repoListEntry: RepoListEntry = {
            name: repo,
            owner: model.repos[ repo ].owner,
            isSim: model.repos[ repo ].isSim,
            isRunnable: model.repos[ repo ].isRunnable,
            supportsInteractiveDescription: model.repos[ repo ].supportsInteractiveDescription,
            supportsVoicing: model.repos[ repo ].supportsVoicing,
            hasUnitTests: model.repos[ repo ].hasUnitTests,
            branches: Object.keys( model.repos[ repo ].branches )
          };

          return repoListEntry;
        } )
      } ) );
    }
    catch( e ) {
      console.error( `Error in /api/repo-list: ${e}` );
      next( e );
    }
  } );

  app.get( /\/api\/branch-info\/([^/]+)\/([^/]+)$/, async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params[ 0 ];
      const branch = req.params[ 1 ];

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
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
    }
    catch( e ) {
      console.error( `Error in /api/branch-info: ${e}` );
      next( e );
    }
  } );

  // Get latest SHAs from a comma-separated list of repos (on the main branches)
  // Returns { repo1: sha1, repo2: sha2, ... }
  app.get( '/api/latest-shas/:repos', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      // Filter by valid repos
      const repos = req.params.repos.split( ',' ).filter( repo => !!model.repos[ repo ] );

      const result: Record<Repo, SHA> = {};

      await Promise.all( repos.map( repo => ( async () => {
        result[ repo ] = await getLatestSHA( model, repo, 'main' );
      } )() ) );

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( result ) );
    }
    catch( e ) {
      console.error( `Error in /api/latest-shas: ${e}` );
      next( e );
    }
  } );

  // Get the latest SHA for a repo and branch, returns { sha: string }
  app.get( '/api/latest-sha/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params.repo;
      const branch = req.params.branch;

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const result = {
        sha: await getLatestSHA( model, repo, branch )
      };

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( result ) );
    }
    catch( e ) {
      console.error( `Error in /api/latest-sha: ${e}` );
      next( e );
    }
  } );

  app.post( '/api/build/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params.repo;
      const branch = req.params.branch;

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const branchInfo = model.repos[ repo ]?.branches[ branch ];
      if ( !branchInfo || !repo || !branch ) {
        res.status( 404 ).send( 'Unknown repo/branch' );
        return;
      }

      if ( branchInfo.buildJobID !== null ) {
        logger.info( 'Already building', repo, branch, branchInfo.buildJobID );

        res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
        res.send( JSON.stringify( {
          buildJobID: branchInfo.buildJobID
        } ) );
      }
      else {
        const buildJobID = nextJobID++;

        res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
        res.send( JSON.stringify( {
          buildJobID: buildJobID
        } ) );

        await runBuildJob( branchInfo, buildJobID );
      }
    }
    catch( e ) {
      console.error( `Error in /api/build: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/build-events/:id', async ( req: Request, res: Response, next: NextFunction ) => {
    try {

      const id = Number.parseInt( req.params.id, 10 );

      const buildJob = buildJobs[ id ];
      if ( !buildJob ) {
        res.status( 404 ).send( 'Unknown build job id' ); // NOTE: not returning the string just to minimize XSS possibilities
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
    }
    catch( e ) {
      console.error( `Error in /api/build-events: ${e}` );
      next( e );
    }
  } );

  // For updating checkouts
  app.post( '/api/update/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params.repo;
      const branch = req.params.branch;

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const branchInfo = model.repos[ repo ]?.branches[ branch ];
      if ( !branchInfo ) {
        res.status( 404 ).send( 'Unknown repo/branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      if ( branchInfo.updateJobID !== null ) {
        logger.info( 'Already updating', repo, branch, branchInfo.updateJobID );

        res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
        res.send( JSON.stringify( {
          updateJobID: branchInfo.updateJobID
        } ) );
      }
      else {
        const updateJobID = nextJobID++;

        res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
        res.send( JSON.stringify( {
          updateJobID: updateJobID
        } ) );

        await updateBranch( branchInfo, updateJobID );
      }
    }
    catch( e ) {
      console.error( `Error in /api/update: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/update-events/:id', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const id = Number.parseInt( req.params.id, 10 );

      const updateCheckoutJob = updateJobs[ id ];
      if ( !updateCheckoutJob ) {
        res.status( 404 ).send( 'Unknown update checkout job' ); // NOTE: not returning the string just to minimize XSS possibilities
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
    }
    catch( e ) {
      console.error( `Error in /api/update-events: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/log-events', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      req.socket.setTimeout( 0 ); // Keep connection open
      res.writeHead( 200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no' // for nginx
      } );

      const logCallback = ( logEvent: LogEvent ) => {
        res.write( `data: ${JSON.stringify( logEvent )}\n\n` );
      };

      addLogCallback( logCallback );

      const ping = setInterval( () => res.write( ': ping\n\n' ), 15000 );

      req.on( 'close', () => {
        clearInterval( ping );

        removeLogCallback( logCallback );
      } );
    }
    catch( e ) {
      console.error( `Error in /api/log-events: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/last-notable-events', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        lastErrorLogEvents: lastErrorLogEvents,
        lastWarnLogEvents: lastWarnLogEvents
      } ) );
    }
    catch( e ) {
      console.error( `Error in /api/last-notable-events: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/last-commits/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params.repo;
      const branch = req.params.branch;

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const branchInfo = model.repos[ repo ]?.branches[ branch ];
      if ( !branchInfo ) {
        res.status( 404 ).send( 'Unknown repo/branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const commits = await getLatestCommits( repo, branch, 5 );

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        commits: commits
      } ) );
    }
    catch( e ) {
      console.error( `Error in /api/last-commits: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/wrappers', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        wrappers: getRepoList( 'wrappers' )
      } ) );
    }
    catch( e ) {
      console.error( `Error in /api/wrappers: ${e}` );
      next( e );
    }
  } );

  app.get( '/api/query-parameters/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const repo = req.params.repo;
      const branch = req.params.branch;

      if ( !model.repos[ repo ] ) {
        res.status( 404 ).send( 'Unknown repo' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }
      else if ( !model.repos[ repo ].branches[ branch ] ) {
        res.status( 404 ).send( 'Unknown branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const branchInfo = model.repos[ repo ]?.branches[ branch ];
      if ( !branchInfo ) {
        res.status( 404 ).send( 'Unknown repo/branch' ); // NOTE: not returning the string just to minimize XSS possibilities
        return;
      }

      const queryParameters = await getQueryParameters( model, branchInfo );

      res.setHeader( 'Content-Type', 'application/json; charset=utf-8' );
      res.send( JSON.stringify( {
        queryParameters: queryParameters
      } ) );
    }
    catch( e ) {
      console.error( `Error in /api/query-parameters: ${e}` );
      next( e );
    }
  } );

  app.get( /^\/(.+)\.js$/, async ( req: Request, res: Response, next: NextFunction ) => {
    try {
      const key = req.params[ 0 ].replace( 'chipper/dist/js/', '' ).replace( /^\/+/, '' );
      const reqPath = req.path.replace( 'chipper/dist/js/', '' );

      const statWithExtension = await getStatWithExtension( key );

      // NOTE: For security, getStatWithExtension will essentially ensure that the file is within ROOT_DIR,
      // and exists (so that we'll be serving an actual file)
      if ( statWithExtension ) {
        const stat = statWithExtension.stat;
        const extension = statWithExtension.extension;
        const pathWithExtension = path.join( ROOT_DIR, key + '.' + extension );
        const isJS = extension === 'js';

        // phet-io-wrappers-main uses import.meta.url, which MESSES with bundling bad (and gives the wrong results)
        const isEntryPoint = ( key.endsWith( '-main' ) && !key.includes( 'phet-io-wrappers-main' ) ) || key.endsWith( '-tests' );

        const cacheEntry = jsCache.get( key );

        const singleFileEtag = getWeakEtag( stat.mtimeMs, stat.size );

        if ( !isEntryPoint ) {
          res.setHeader( 'ETag', singleFileEtag );
        }
        res.setHeader( 'Last-Modified', new Date( stat.mtimeMs ).toUTCString() );
        res.setHeader( 'Content-Type', 'application/javascript; charset=utf-8' );
        // NOTE: cache control header set way earlier

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
      console.error( `Error in JS/TS handler for ${req.path}: ${e}` );
      next( e );
    }
  } );

  // Static hosting for other files
  app.use( express.static( ROOT_DIR, {
    etag: true,
    redirect: false
  } ) );

  // Static hosting for launchpad build
  app.use( express.static( `${ROOT_DIR}/launchpad/dist`, {
    etag: true,
    redirect: false
  } ) );

  // If static didn't find a file (esp. index.html in a dir), serveIndex will check if it's a directory and list contents.
  app.use( serveIndex( ROOT_DIR, { icons: true } ) ); // Optional: adds icons

  const server = http.createServer( app );

  // Handle server errors (e.g., port already in use)
  server.on( 'error', ( err: Error ) => {
    if ( err.message.includes( 'EADDRINUSE' ) ) {
      logger.error( `Error: Port ${port} is already in use. Try specifying a different port with --port=NUMBER` );
    }
    else {
      logger.error( 'Server startup error:', err );
    }
    process.exit( 1 );
  } );

  server.listen( port, () => {
    logger.info( `Phettest Server listening at http://localhost:${port}/` );
    logger.info( `Serving files from: ${ROOT_DIR}` );
  } );

  // catching signals for log before exiting (useful for pm2 restarting)
  [ 'SIGINT', 'SIGHUP', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT', 'SIGBUS', 'SIGFPE', 'SIGUSR1',
    'SIGSEGV', 'SIGUSR2', 'SIGTERM', 'beforeExit', 'uncaughtException', 'unhandledRejection'
  ].forEach( sig => process.on( sig, ( error: Error ) => {
    logger.info( `exiting from ${sig}`, error );
    process.exit( 1 );
  } ) );
} )().catch( e => { throw e; } );