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
import type { Branch, BranchInfo, Repo, RepoListEntry, SHA } from '../types/common-types.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import basicAuth from 'basic-auth';
import { config } from './config.js';
import { model, saveModel } from './model.js';
import { checkClean, port, ROOT_DIR } from './options.js';
import { buildMain, buildReleaseBranch, getDirectorySHA, getDirectoryTimestampBranch, getRepoDirectory, getStaleBranches, isDirectoryClean, updateReleaseBranchCheckout } from './util.js';
import { updateModel } from './updateModel.js';
import { bundleFile, transpileTS } from './bundling.js';

const ReleaseBranch = ReleaseBranchImport.default;


( async () => {
  // To do list:
  //
  // Use generate-data to see what flags we need to search for (e.g. simFeatures.supportsInteractiveDescription for a11y-view below)
  //
  // - SHOW out of date repos
  // - SHOW latest commits?

  // - Bayes launchpad --- remove checkout buttons, and maybe built -- "force rebuild"
  //
  // - github SHA link
  //
  // - Auto-modulification? --- separate service
  //
  // - LOCK so we don't build while an update to a dependency is happening? Or update while a build is happening?
  // - SHOW whether the build is for the latest SHAs
  // - update job ID also works for the "git pull"
  //
  // - REQUEST RESPONSE for checking latest github-side SHAs for a set of repos (to show in UI)
  //   - Polling for this type of thing (or hit github API if it is fast)
  //
  // - update model periodically (or on demand --- button?)
  // - IF no autoUpdate, allow a manual "sync" or "sync all branches" (i.e. local developer machine)
  //   - DO NOT auto-update launchpad - note that pulls of launchpad likely require rebuild of launchpad for serving to work
  //     -- OR does that mean when launchpad gets pulled, we just auto-rebuild it?
  //   - Sync
  //     - first npm-updated chipper, perennial-alias, perennial
  //     - then sync --transpile=true --status=false logPull=false logFormatting=false --npmUpdate=false --checkoutMain=true (????)
  //     - Then check lists?
  //   - Auto-update on release branches:
  //     - Should we auto-build here?
  //
  // - What remote operations can we speed up by just using octokit?
  //
  // - Auto-build? (per-branch option perhaps?)
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
  //   - Dark theme (auto / light / dark)
  //     - Gear for settings
  //   - Load which locales are supported(!)
  // - REST API
  //   - build, sync, status, repo-status, perhaps others?
  //   - Build:
  //     - Allow toggling of "auto build"
  //     - No concurrent builds for the same repo (building multiple sims at a time is fine)
  //     - All brands except for adapted-from-phet (from simPackage.phet?.supportedBrands)
  //     - (and do we skip linting and type-checking?) --- what about uglify?
  // - Test on Windows
  // - Get release branch unbuilt running
  // - Complete package-lock items
  // - Status?

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

  await updateModel( model );
  saveModel();

  ( async () => {
    console.log( await getStaleBranches( model ) );
  } )().catch( e => { throw e; } );

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

  const app = express();

  // Global cache-control and authentication
  app.use( ( req: Request, res: Response, next: NextFunction ) => {

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

  app.get( '/api/repo-list', async ( req: Request, res: Response, next: NextFunction ) => {
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
  } );

  app.get( /\/api\/branch-info\/([^/]+)\/([^/]+)$/, async ( req: Request, res: Response, next: NextFunction ) => {
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

  // TODO: move the build job logic to another file https://github.com/phetsims/phettest/issues/20
  app.post( '/api/build/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
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

        // TODO: improved persistence model https://github.com/phetsims/phettest/issues/20
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

  app.get( '/api/build-events/:id', async ( req: Request, res: Response, next: NextFunction ) => {
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
  app.post( '/api/update/:repo/:branch', async ( req: Request, res: Response, next: NextFunction ) => {
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
          const repoDirectory = getRepoDirectory( repo, branch );

          branchInfo.lastUpdatedTime = Date.now();
          branchInfo.isCheckedOut = true;
          branchInfo.currentBranch = null; // not used for checkouts
          branchInfo.sha = await getDirectorySHA( repoDirectory );
          branchInfo.timestamp = await getDirectoryTimestampBranch( repoDirectory, branch );
          branchInfo.isClean = checkClean ? await isDirectoryClean( repoDirectory ) : true;

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

  app.get( '/api/update-events/:id', async ( req: Request, res: Response, next: NextFunction ) => {
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

  app.get( /^\/(.+)\.js$/, async ( req: Request, res: Response, next: NextFunction ) => {
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
      console.error( `Error: Port ${port} is already in use. Try specifying a different port with --port=NUMBER` );
    }
    else {
      console.error( 'Server startup error:', err );
    }
    process.exit( 1 );
  } );

  server.listen( port, () => {
    console.log( `Phettest Server listening at http://localhost:${port}/` );
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