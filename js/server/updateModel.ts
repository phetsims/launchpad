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
import type { ModelBranchInfo, Repo } from '../types/common-types.js';
import pLimit from 'p-limit';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';
// eslint-disable-next-line phet/default-import-match-filename
import ReleaseBranchImport from '../../../perennial/js/common/ReleaseBranch.js';
import getFileAtBranch from '../../../perennial/js/common/getFileAtBranch.js';
import { model, Model } from './model.js';
import { checkClean, ROOT_DIR } from './options.js';
import { getDirectoryBranch, getDirectorySHA, getDirectoryTimestampBranch, getPackageJSON, getRepoDirectory, isDirectoryClean } from './util.js';
import gitCloneDirectory from '../../../perennial/js/common/gitCloneDirectory.js';

const execute = executeImport.default;
const ReleaseBranch = ReleaseBranchImport.default;

export const updateModelBranchInfo = async ( branchInfo: ModelBranchInfo, runnableDependencies: Repo[] ): Promise<void> => {
  branchInfo.dependencyRepos = runnableDependencies;

  if ( !branchInfo.isCheckedOut ) {
    return;
  }

  const repo = branchInfo.repo;
  const branch = branchInfo.branch;
  const repoDirectory = getRepoDirectory( repo, branch );

  await Promise.all( [
    ( async () => {
      branchInfo.currentBranch = branch === 'main' ? await getDirectoryBranch( repoDirectory ) : null;
    } )(),
    ( async () => {
      branchInfo.sha = await getDirectorySHA( repoDirectory );
    } )(),
    ( async () => {
      branchInfo.timestamp = await getDirectoryTimestampBranch( repoDirectory, branch );
    } )(),
    ( async () => {
      branchInfo.isClean = checkClean ? await isDirectoryClean( repoDirectory ) : true;
    } )(),
    ( async () => {
      if ( branch === 'main' ) {
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

  const releaseBranches = await ReleaseBranch.getAllMaintenanceBranches();

  await Promise.all( releaseBranches.map( releaseBranch => limit( async () => {
    const repo = releaseBranch.repo;
    const branch = releaseBranch.branch;

    // no-op for now, we will do the release branch checks on the next run
    if ( !model.repos[ repo ] ) {
      return;
    }

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

        // TODO: update these bits (just in case) on release branch updates https://github.com/phetsims/phettest/issues/20
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
};

export const updateModel = async ( model: Model ): Promise<void> => {
  console.log( 'updating model' );

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

  // Determine the repo dependencies for each runnable
  const runnableDependenciesMap: Record<Repo, Repo[]> = JSON.parse( await execute(
    tsxCommand,
    [ 'js/scripts/print-multiple-dependencies.ts', activeRunnables.join( ',' ) ],
    path.join( ROOT_DIR, 'chipper' )
  ) );

  await Promise.all( [
    // Search for new release branches (ensure this is kicked off at the start, since it will take a bit)
    async () => {
      await searchForNewReleaseBranches();
    },

    // Initialize new repos
    ...newRepos.map( newRepo => async () => {
      // TODO: how do we skip private repos in the future?
      if ( !fs.existsSync( path.join( ROOT_DIR, newRepo ) ) ) {
        await gitCloneDirectory( newRepo, ROOT_DIR );
      }

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

        updateCheckoutJobID: null,
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

  console.log( 'finised updating model' );
};
