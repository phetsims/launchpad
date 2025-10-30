// Copyright 2025, University of Colorado Boulder

/**
 * Main model updates for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import path from 'path';
import fs from 'fs';
import getActiveRepos from '../../../perennial/js/common/getActiveRepos.js';
import getActiveRunnables from '../../../perennial/js/common/getActiveRunnables.js';
import getActiveSceneryStackRepos from '../../../perennial/js/common/getActiveSceneryStackRepos.js';
import tsxCommand from '../../../perennial/js/common/tsxCommand.js';
import type { ModelBranchInfo, QueryParameter, Repo } from '../types/common-types.js';
import pLimit from 'p-limit';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import { model, Model, saveModel } from './model.js';
import { checkClean, ROOT_DIR, useGithubAPI } from './options.js';
import { getBranchRootDirectory, getDirectoryBranch, getDirectorySHA, getDirectoryTimestampBranch, getLocalesForRepo, getPackageJSON, getRepoDirectory, isDirectoryClean } from './util.js';
import gitCloneDirectory from '../../../perennial/js/common/gitCloneDirectory.js';
import { npmLimit } from './globals.js';
import npmUpdateDirectory from '../../../perennial/js/common/npmUpdateDirectory.js';
import getRemoteBranchSHAs from '../../../perennial/js/common/getRemoteBranchSHAs.js';
import { githubGetLatestBranchSHA } from './github-api.js';
import { logger } from './logging.js';
import { extractQueryParameters } from './extractQueryParameters.js';

const execute = executeImport.default;
const ReleaseBranch = ReleaseBranchImport.default;

export const updateModelBranchInfo = async (
  branchInfo: ModelBranchInfo,
  runnableDependencies?: Repo[]
): Promise<void> => {
  // If we don't provide runnableDependencies, recompute it (in a separate try-catch for error handling)
  try {
    if ( runnableDependencies === undefined ) {
      if ( getActiveRunnables().includes( branchInfo.repo ) ) {
        const runnableDependenciesMap: Record<Repo, Repo[]> = JSON.parse( await execute(
          tsxCommand,
          [ 'js/scripts/print-multiple-dependencies.ts', branchInfo.repo ],
          path.join( ROOT_DIR, 'chipper' )
        ) );

        runnableDependencies = runnableDependenciesMap[ branchInfo.repo ] || [];
      }
      else {
        runnableDependencies = [];
      }
    }

    // Implicitly add babel as a dependency to any runnable (so that we will get updated builds on translation changes)
    if ( runnableDependencies.length > 2 && !runnableDependencies.includes( 'babel' ) ) {
      runnableDependencies.push( 'babel' );
    }

    branchInfo.dependencyRepos = runnableDependencies;
  }
  catch( e ) {
    logger.error( 'unable to compute runnable dependencies for', branchInfo.repo, e );
    logger.error( e );
  }

  if ( !branchInfo.isCheckedOut ) {
    return;
  }

  const repo = branchInfo.repo;
  const branch = branchInfo.branch;
  const repoDirectory = getRepoDirectory( repo, branch );

  await Promise.all( [
    ( async () => {
      try {
        branchInfo.currentBranch = branch === 'main' ? await getDirectoryBranch( repoDirectory ) : null;

        if ( branchInfo.currentBranch !== 'main' && branch === 'main' ) {
          logger.warn( `Warning: expected main branch for ${repo} but found ${branchInfo.currentBranch}` );
        }
      }
      catch( e ) {
        logger.error( `unable to get current branch for ${repo} ${branch}: ${e}` );
      }
    } )(),
    ( async () => {
      try {
        branchInfo.sha = await getDirectorySHA( repoDirectory );
      }
      catch( e ) {
        logger.error( `unable to get SHA for ${repo} ${branch}: ${e}` );
      }
    } )(),
    ( async () => {
      try {
        branchInfo.timestamp = await getDirectoryTimestampBranch( repoDirectory, branch );
      }
      catch( e ) {
        logger.error( `unable to get timestamp for ${repo} ${branch}: ${e}` );
      }
    } )(),
    ( async () => {
      try {
        branchInfo.isClean = checkClean ? await isDirectoryClean( repoDirectory ) : true;

        if ( !branchInfo.isClean ) {
          logger.warn( `Warning: repository ${repo} on branch ${branch} is not clean.` );
        }
      }
      catch( e ) {
        logger.error( `unable to get clean status for ${repo} ${branch}: ${e}` );
      }
    } )(),
    ( async () => {
      if ( branch === 'main' ) {
        try {
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
          branchInfo.brands = brands;
        }
        catch( e ) {
          logger.error( `unable to get brands for ${repo} ${branch}: ${e}` );
        }
      }
    } )()
  ] );
};

export const updateRepoInfo = async ( repo: Repo, owner: string, repoInfo: {
  name: Repo;
  owner: string; // (from data/active-scenerystack-repos)
  isSim: boolean; // phet.simulation
  isRunnable: boolean; // phet.runnable
  supportsInteractiveDescription: boolean; // phet.simFeatures.supportsInteractiveDescription
  supportsVoicing: boolean; // phet.simFeatures.supportsVoicing
  hasUnitTests: boolean; // phet.generatedUnitTests
} ): Promise<void> => {
  const packageJSON = await getPackageJSON( getRepoDirectory( repo, 'main' ) );

  repoInfo.owner = owner;
  repoInfo.isSim = !!packageJSON?.phet?.simulation;
  repoInfo.isRunnable = !!packageJSON?.phet?.runnable;
  repoInfo.supportsInteractiveDescription = !!packageJSON?.phet?.simFeatures?.supportsInteractiveDescription;
  repoInfo.supportsVoicing = !!packageJSON?.phet?.simFeatures?.supportsVoicing;
  repoInfo.hasUnitTests = !!packageJSON?.phet?.generatedUnitTests;
};

export const searchForNewReleaseBranches = async (): Promise<void> => {
  const limit = pLimit( 30 );

  let releaseBranches: ReleaseBranch[] = [];
  try {
    releaseBranches = await ReleaseBranch.getAllMaintenanceBranches();
  }
  catch( e ) {
    logger.error( `unable to get release branches: ${e}` );
    return;
  }

  await Promise.all( releaseBranches.map( releaseBranch => limit( async () => {
    const repo = releaseBranch.repo;
    const branch = releaseBranch.branch;

    // no-op for now, we will do the release branch checks on the next run
    if ( !model.repos[ repo ] ) {
      return;
    }

    if ( !model.repos[ repo ].branches[ branch ] ) {
      try {
        // const packageJSON = JSON.parse( await getFileAtBranch( repo, branch, 'package.json' ) );
        const packageJSON = JSON.parse( await execute( 'git', [ 'show', `origin/${branch}:./package.json` ], `../${repo}` ) );

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

          // TODO: update these bits (just in case) on release branch updates https://github.com/phetsims/phettest/issues/20
          isChipper2: await releaseBranch.usesChipper2(),
          usesOldPhetioStandalone: await releaseBranch.usesOldPhetioStandalone(),
          usesRelativeSimPath: await releaseBranch.usesRelativeSimPath(),
          usesPhetioStudio: await releaseBranch.usesPhetioStudio(),
          usesPhetioStudioIndex: await releaseBranch.usesPhetioStudioIndex(),

          buildJobID: null,
          lastBuiltTime: null,
          lastBuildSHAs: {},

          updateJobID: null,
          lastUpdatedTime: null,

          npmUpdated: true // We will handle this manually
        };
      }
      catch( e ) {
        logger.error( `unable to initialize release branch ${repo} ${branch}: ${e}` );
      }
    }
  } ) ) );
};

const updateModelLimit = pLimit( 1 );

export const updateModel = async ( model: Model ): Promise<void> => {
  // only run one of the updateModel at a time
  return updateModelLimit( async () => {
    logger.info( 'updating model' );

    const activeRepos = getActiveRepos();
    const activeRunnables = getActiveRunnables();
    const sceneryStackRepos = getActiveSceneryStackRepos();

    const repos = [ ...new Set( [
      ...activeRepos,
      ...activeRunnables,
      ...sceneryStackRepos
    ] ) ].sort();

    const existingRepos = Object.keys( model.repos );
    const newRepos = repos.filter( repo => !existingRepos.includes( repo ) );
    const removedRepos = existingRepos.filter( repo => !repos.includes( repo ) );

    const getOwner = ( repo: Repo ): string => {
      return sceneryStackRepos.includes( repo ) ? 'scenerystack' : 'phetsims';
    };

    // Remove old repos
    for ( const oldRepo of removedRepos ) {
      delete model.repos[ oldRepo ];
    }

    // Ensure we are fully cloned first
    await Promise.all( newRepos.map( async newRepo => {
      try {
        if ( !fs.existsSync( path.join( ROOT_DIR, newRepo ) ) ) {
          await gitCloneDirectory( newRepo, ROOT_DIR );
        }
      }
      catch( e ) {
        logger.error( `unable to clone new repo ${newRepo}: ${e}` );
      }
    } ) );

    // Determine the repo dependencies for each runnable
    let runnableDependenciesMap: Record<Repo, Repo[]> = {};
    try {
      // In case we weren't able to check everything out, wrap a try-catch around this
      runnableDependenciesMap = JSON.parse( await execute(
        tsxCommand,
        [ 'js/scripts/print-multiple-dependencies.ts', activeRunnables.join( ',' ) ],
        path.join( ROOT_DIR, 'chipper' )
      ) );
    }
    catch( e ) {
      logger.error( `unable to compute runnable dependencies map: ${e}` );
    }

    try {
      await Promise.all( [
        // Search for new release branches (ensure this is kicked off at the start, since it will take a bit)
        async () => {
          await searchForNewReleaseBranches();
        },

        // Initialize new repos
        ...newRepos.map( newRepo => async () => {
          try {

            const packageJSON = await getPackageJSON( getRepoDirectory( newRepo, 'main' ) );

            const mainBranchInfo: ModelBranchInfo = {
              repo: newRepo,
              branch: 'main',

              version: packageJSON?.version ?? null,
              phetPackageJSON: packageJSON?.phet ?? null,
              brands: [], // filled in by updateModelBranchInfo
              isReleased: false, // main is never released
              dependencyRepos: [], // filled in by updateModelBranchInfo

              isCheckedOut: true,
              currentBranch: null, // filled in by updateModelBranchInfo
              sha: null, // filled in by updateModelBranchInfo
              timestamp: null, // filled in by updateModelBranchInfo
              isClean: true, // filled in by updateModelBranchInfo

              // TODO: update these bits (just in case) on release branch updates https://github.com/phetsims/phettest/issues/20
              isChipper2: true,
              usesOldPhetioStandalone: false,
              usesRelativeSimPath: true,
              usesPhetioStudio: true,
              usesPhetioStudioIndex: true,

              buildJobID: null,
              lastBuiltTime: null,
              lastBuildSHAs: {},

              updateJobID: null,
              lastUpdatedTime: null,

              npmUpdated: false
            };

            await updateModelBranchInfo( mainBranchInfo, runnableDependenciesMap[ newRepo ] || [] );

            const owner = getOwner( newRepo );

            const repoInfo = {
              name: newRepo,
              owner: owner,
              isSim: false, // updated below
              isRunnable: false, // updated below
              supportsInteractiveDescription: false, // updated below
              supportsVoicing: false, // updated below
              hasUnitTests: false, // updated below
              branches: {
                main: mainBranchInfo
              }
            };

            await updateRepoInfo( newRepo, owner, repoInfo );

            model.repos[ newRepo ] = repoInfo;
            saveModel();

            ( async () => {
              await updateNodeModules( model, newRepo );
            } )().catch( e => logger.error( `async updateNodeModules error ${newRepo}: ${e}` ) );
          }
          catch( e ) {
            logger.error( `unable to initialize new repo ${newRepo}: ${e}` );
          }
        } ),

        // Update existing repos (and all of their branches)
        ...existingRepos.flatMap( repo => {
          const branches = Object.keys( model.repos[ repo ].branches );

          return [
            async () => {
              await updateRepoInfo( repo, getOwner( repo ), model.repos[ repo ] );
            },
            ...branches.map( branch => async () => {
              await updateModelBranchInfo( model.repos[ repo ].branches[ branch ], branch === 'main' ? runnableDependenciesMap[ repo ] || [] : [] );
            } )
          ];
        } )
      ].map( pLimit( 30 ) ) );
    }
    catch( e ) {
      logger.error( `error while updating model: ${e}` );
    }

    saveModel();

    logger.info( 'finished updating model' );
  } );
};

export const invalidateNodeModules = ( model: Model, repo: Repo ): void => {
  model.repos[ repo ].branches.main.npmUpdated = false;
};

// Updates node_modules in main branch
export const updateNodeModules = async ( model: Model, repo: Repo ): Promise<void> => {
  return npmLimit( async () => {
    logger.verbose( 'npm update', repo );

    try {
      const repoDirectory = getRepoDirectory( repo, 'main' );

      const packageJSONFile = path.join( repoDirectory, 'package.json' );

      if ( fs.existsSync( packageJSONFile ) ) {
        await npmUpdateDirectory( getRepoDirectory( repo, 'main' ) );
      }

      model.repos[ repo ].branches.main.npmUpdated = true;
      saveModel();
    }
    catch( e ) {
      logger.error( `unable to npm update for ${repo}: ${e}` );
    }
  } );
};

export const recomputeNodeModules = async ( model: Model, repo: Repo ): Promise<void> => {
  invalidateNodeModules( model, repo );

  await updateNodeModules( model, repo );
};

export const singlePassUpdate = async (
  model: Model,
  updateBranch: ( branchInfo: ModelBranchInfo ) => Promise<void>
): Promise<void> => {
  const repos = Object.keys( model.repos );

  const limit = pLimit( 10 );

  await Promise.all( repos.map( repo => limit( async () => {
    try {
      const branches = Object.keys( model.repos[ repo ].branches );

      // no-op if using GitHub API. Otherwise we will... request all of these at the same time (or limit in the future?)
      const branchSHAs = useGithubAPI ? {} : ( await getRemoteBranchSHAs( repo ) as Record<Repo, string> );

      for ( const branch of branches ) {
        try {
          // NOTE: skipping currently-updating branches
          if ( model.repos[ repo ].branches[ branch ].updateJobID === null && model.repos[ repo ].branches[ branch ].isCheckedOut ) {
            const localSHA = model.repos[ repo ].branches[ branch ].sha;
            const remoteSHA = useGithubAPI ? ( await githubGetLatestBranchSHA( model.repos[ repo ].owner, repo, branch ) ) : branchSHAs[ branch ];

            if ( localSHA && remoteSHA && localSHA !== remoteSHA ) {
              logger.verbose( repo, branch, 'is stale, updating', localSHA, remoteSHA );

              updateBranch( model.repos[ repo ].branches[ branch ] ).catch( e => logger.error( `update branch failure: ${e}` ) );
            }
          }
        }
        catch( e ) {
          logger.error( `error during singlePassUpdate for ${repo} ${branch}: ${e}` );
        }
      }
    }
    catch( e ) {
      logger.error( `error during singlePassUpdate for ${repo}: ${e}` );
    }
  } ) ) );
};

const queryParameterCache: Record<string, QueryParameter[]> = {};

export const getQueryParameters = async ( model: Model, branchInfo: ModelBranchInfo ): Promise<QueryParameter[]> => {
  const rootDirectory = getBranchRootDirectory( branchInfo.repo, branchInfo.branch );

  const dependencyRepos = branchInfo.dependencyRepos;

  const queryParameters: QueryParameter[] = [];

  const localesPromise = getLocalesForRepo( branchInfo.repo );

  await Promise.all( dependencyRepos.map( async dependencyRepo => {
    try {
      const directory = path.join( rootDirectory, dependencyRepo );
      const sha = branchInfo.branch === 'main' ? model.repos[ dependencyRepo ].branches.main.sha : await getDirectorySHA( directory );
      const cacheKey = `${dependencyRepo}@${sha}`;

      if ( queryParameterCache[ cacheKey ] ) {
        logger.debug( `using cached query parameters for ${cacheKey}` );
        queryParameters.push( ...queryParameterCache[ cacheKey ] );
      }
      else {
        logger.debug( `extracting query parameters for ${cacheKey}` );
        const repoQueryParameters = await extractQueryParameters( dependencyRepo, directory );
        queryParameters.push( ...repoQueryParameters );

        // eslint-disable-next-line require-atomic-updates
        queryParameterCache[ cacheKey ] = repoQueryParameters;
      }
    }
    catch( e ) {
      logger.warn( `unable to get query parameters for dependency ${dependencyRepo} of ${branchInfo.repo} ${branchInfo.branch}: ${e}` );
    }
  } ) );

  const locales = await localesPromise;

  // TODO: don't use filters (for performance)

  queryParameters.sort( ( a, b ) => a.name.localeCompare( b.name ) );

  // Overrides section (for things we can and should fill in that would be otherwise computed in runtime sim code)
  queryParameters.filter( queryParameter => queryParameter.name === 'brand' ).forEach( queryParameter => {
    queryParameter.validValues = [ ...branchInfo.brands, 'adapted-from-phet' ];
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'colorProfiles' ).forEach( queryParameter => {
    queryParameter.defaultValue = 'default';
    queryParameter.validValues = branchInfo.phetPackageJSON?.simFeatures?.colorProfiles ?? [ 'default' ];
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'interruptMultitouch' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.interruptMultitouch ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'locale' ).forEach( queryParameter => {
    queryParameter.defaultValue = 'en';
    queryParameter.validValues = locales;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsDynamicLocale' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsDynamicLocale ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'preventMultitouch' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.preventMultitouch ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'regionAndCulture' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.defaultRegionAndCulture ?? 'usa';
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsInteractiveDescription' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsInteractiveDescription ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsInteractiveHighlights' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsInteractiveHighlights ?? branchInfo.phetPackageJSON?.simFeatures?.supportsInteractiveDescription;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsGestureControl' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsGestureControl ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsVoicing' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsVoicing ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsCoreVoicing' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsCoreVoicing ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsPanAndZoom' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsPanAndZoom ?? true;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsSound' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsSound ?? false;
  } );
  queryParameters.filter( queryParameter => queryParameter.name === 'supportsExtraSound' ).forEach( queryParameter => {
    queryParameter.defaultValue = branchInfo.phetPackageJSON?.simFeatures?.supportsExtraSound ?? false;
  } );

  return queryParameters;
};