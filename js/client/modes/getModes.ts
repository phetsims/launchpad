// Copyright 2025, University of Colorado Boulder

/**
 * Returns the given modes and UIs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, QueryParameter, RepoListEntry } from '../../types/common-types.js';
import { ViewContext } from '../ViewContext.js';
import { showAdvancedProperty } from '../settings.js';
import { ModeData } from './mode-types.js';
import { EmptyCustomizationNode } from './EmptyCustomizationNode.js';
import { SimpleUnbuiltBuiltCustomizationNode } from './SimpleUnbuiltBuiltCustomizationNode.js';
import { WrappersNode } from './WrappersNode.js';
import { DevCustomizationNode, ProductionCustomizationNode } from './VersionListingCustomizationNode.js';

export const getModes = (
  repoListEntry: RepoListEntry,
  branchInfo: BranchInfo,
  queryParametersPromise: Promise<QueryParameter[]>,
  viewContext: ViewContext
): ModeData[] => {

  const repo = branchInfo.repo;
  const owner = repoListEntry.owner;

  const modes: ModeData[] = [];

  // const versionString = branchInfo.version || '';

  const isRunnable = repoListEntry.isRunnable;
  const isCheckedOut = branchInfo.isCheckedOut;
  const isMainBranch = branchInfo.branch === 'main';
  const hasBuild = branchInfo.lastBuiltTime !== null;
  const hasUnitTests = repoListEntry.hasUnitTests;
  const supportsPhet = branchInfo.brands.includes( 'phet' );
  const supportsPhetio = branchInfo.brands.includes( 'phet-io' );
  const supportsInteractiveDescription = repoListEntry.supportsInteractiveDescription;
  const showAdvanced = showAdvancedProperty.value;

  const releaseBranchPrefix = branchInfo.branch === 'main' ? '' : `release-branches/${branchInfo.repo}-${branchInfo.branch}/`;
  const repoDirectory = `${releaseBranchPrefix}${repo}`;

  const phetioStandaloneQueryParameters = branchInfo.usesOldPhetioStandalone ? 'phet-io.standalone' : 'phetioStandalone';
  const proxiesParams = branchInfo.usesRelativeSimPath ? 'relativeSimPath' : 'launchLocalVersion';
  const studioName = supportsPhetio && branchInfo.usesPhetioStudio ? 'studio' : 'instance-proxies';
  const studioNameBeautified = studioName === 'studio' ? 'Studio' : 'Instance Proxies';
  const usesChipper2 = branchInfo.isChipper2;
  const phetFolder = usesChipper2 ? '/phet' : '';
  const phetioFolder = usesChipper2 ? '/phet-io' : '';
  const phetSuffix = usesChipper2 ? '_phet' : '';
  const phetioSuffix = usesChipper2 ? '_all_phet-io' : '_en-phetio';
  // const phetioBrandSuffix = usesChipper2 ? '' : '-phetio';
  const studioPathSuffix = branchInfo.usesPhetioStudioIndex ? '/' : `/${studioName}.html?sim=${branchInfo.repo}&${proxiesParams}`;
  // const phetioDevVersion = usesChipper2 ? versionString : versionString.split( '-' ).join( '-phetio' );

  const simSpecificWrappers: string[] = supportsPhetio ? ( branchInfo.phetPackageJSON?.[ 'phet-io' ]?.wrappers ?? [] ) : [];

  const nonStudioQueryParametersPromise = queryParametersPromise.then( queryParameters => {
    return queryParameters.filter( queryParameter => queryParameter.repo !== 'studio' );
  } );

  // `](https://phet-dev.colorado.edu/html/${this.repo}/${versionString}${phetFolder}/${this.repo}_all${phetSuffix}.html)`

  // TODO: locale-specific versions perhaps? https://github.com/phetsims/phettest/issues/20
  isRunnable && isCheckedOut && supportsPhet && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'phet',
    description: 'Runs the PhET-brand simulation',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${repoDirectory}/${repo}_en.html` : null,
        hasBuild ? `${repoDirectory}/build${phetFolder}/${repo}_all${phetSuffix}.html` : null,
        nonStudioQueryParametersPromise,
        viewContext,
        {
          ea: undefined,
          brand: 'phet',
          debugger: undefined
        },
        {}
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'phet-io',
    description: 'Runs the simulation in phet-io standalone mode',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${repoDirectory}/${repo}_en.html` : null,
        hasBuild ? `${repoDirectory}/build${phetioFolder}/${repo}${phetioSuffix}.html` : null,
        nonStudioQueryParametersPromise,
        viewContext,

        {
          ea: undefined,
          brand: 'phet-io',
          [ phetioStandaloneQueryParameters ]: undefined,
          debugger: undefined
        },
        {
          [ phetioStandaloneQueryParameters ]: undefined
        }
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'studio',
    description: `Runs the simulation in ${studioNameBeautified}`,
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${releaseBranchPrefix}studio/` : null,
        hasBuild ? `${repoDirectory}/build${phetioFolder}/wrappers/${studioName}${studioPathSuffix}` : null,
        queryParametersPromise,
        viewContext,
        {
          sim: repo,
          phetioElementsDisplay: 'all',
          phetioWrapperDebug: true
        },
        {
          phetioElementsDisplay: 'all'
        }
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && isMainBranch && modes.push( {
    name: 'wrappers',
    description: 'Runs phet-io wrappers',
    createCustomizationNode: () => {
      return new WrappersNode(
        repo,
        !!branchInfo.lastBuiltTime,
        simSpecificWrappers,
        releaseBranchPrefix,
        phetioFolder,
        viewContext
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && isMainBranch && showAdvanced && modes.push( {
    name: 'wrapper unit tests',
    description: 'Runs the phet-io wrapper unit tests',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phet-io-wrappers/phet-io-wrappers-tests.html?sim=${repo}` );
    }
  } );

  isRunnable && isCheckedOut && supportsInteractiveDescription && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'a11y view',
    description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${releaseBranchPrefix}chipper/wrappers/a11y-view/` : null,
        hasBuild ? `${repoDirectory}/build${phetFolder}/${repo}_a11y_view.html` : null,
        nonStudioQueryParametersPromise,
        viewContext,
        {
          sim: repo,
          brand: 'phet',
          ea: undefined,
          debugger: undefined
        },
        {}
      );
    }
  } );

  isRunnable && isCheckedOut && hasBuild && modes.push( {
    name: 'xhtml',
    description: 'Runs the built simulation XHTML',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/build${phetFolder}/xhtml/${repo}_all.xhtml` );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'color editor',
    description: 'Runs the top-level -colors.html file (allows editing/viewing different profile colors)',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phetmarks/color-editor.html?sim=${repo}` );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'production',
    description: 'Runs production versions (defaults to the latest)',
    createCustomizationNode: () => {
      return new ProductionCustomizationNode( repo, viewContext );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'dev (bayes)',
    description: 'Loads the location on phet-dev.colorado.edu with versions for each dev deploy',
    createCustomizationNode: () => {
      return new DevCustomizationNode( repo, viewContext );
    }
  } );

  // repo === 'phet-io' && modes.push( {
  //   name: 'fuzz-test studio wrapper',
  //   description: 'Runs automated testing with fuzzing on studio, 15 second timer',
  //   createCustomizationNode: () => {
  //     return new EmptyCustomizationNode( `../aqua/fuzz-lightyear/?fuzz&wrapperName=studio&wrapperContinuousTest=%7B%7D&repos=${TODO phetio sims joined by comma}` );
  //   }
  // } );
  // repo === 'phet-io' && modes.push( {
  //   name: 'test-migration-sims',
  //   text: 'Fuzz Test Migration',
  //   description: 'Runs automated testing with fuzzing on studio, 10 second timer',
  //   url: '../aqua/fuzz-lightyear/',
  //   queryParameters: getFuzzLightyearParameters( 20000 ).concat( migrationQueryParameters ).concat( [ {
  //     value: 'fuzz&wrapperName=migration&wrapperContinuousTest=%7B%7D&migrationRate=2000&' +
  //            `phetioMigrationReport=assert&repos=${phetioHydrogenSims.map( simData => simData.sim ).join( ',' )}`,
  //     text: 'Fuzz Test PhET-IO sims',
  //     default: true
  //   } ] )
  // } );
  // repo === 'phet-io' && modes.push( {
  //   name: 'test-state-sims',
  //   text: 'Fuzz Test State Wrapper',
  //   description: 'Runs automated testing with fuzzing on state, 15 second timer',
  //   url: '../aqua/fuzz-lightyear/',
  //   queryParameters: getFuzzLightyearParameters( 15000 ).concat( [ {
  //     value: `fuzz&wrapperName=state&setStateRate=3000&wrapperContinuousTest=%7B%7D&repos=${phetioSims.join( ',' )}`,
  //     text: 'Fuzz Test PhET-IO sims',
  //     default: true
  //   } ] )
  // } );

  repo === 'phet-io-website' && modes.push( {
    name: 'view local',
    description: 'view the local root of the website',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phet-io-website/root/` );
    }
  } );

  hasUnitTests && modes.push( {
    name: 'unit tests (unbuilt)',
    description: 'Runs unit tests in unbuilt mode',
    createCustomizationNode: () => {
      // TODO: provide phet-io brand if phet-io/tandem/phet-io-wrappers?
      return new EmptyCustomizationNode( `${repoDirectory}/${repo}-tests.html` );
    }
  } );

  [ 'phet-io', 'binder' ].includes( repo ) && modes.push( {
    name: 'documentation',
    description: 'Browse HTML documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/doc${repo === 'binder' ? 's' : ''}/` );
    }
  } );

  repo === 'scenery' && modes.push( {
    name: 'basics documentation',
    description: 'Scenery Basics Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-basics/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'layout documentation',
    description: 'Scenery Layout Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-layout/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'input documentation',
    description: 'Scenery Input Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-input/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'accessibility documentation',
    description: 'Scenery Accessibility Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-accessibility/' );
    }
  } );

  ( repo === 'scenery' || repo === 'kite' || repo === 'dot' || repo === 'phet-core' || repo === 'alpenglow' ) && modes.push( {
    name: 'playground',
    description: `Loads ${repo} and dependencies in the tab, and allows quick testing`,
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/tests/playground.html` );
    }
  } );

  repo === 'scenery' && modes.push( {
    name: 'sandbox',
    description: 'Allows quick testing of Scenery features',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/tests/sandbox.html` );
    }
  } );

  repo === 'yotta' && modes.push( {
    name: 'statistics page',
    description: 'Goes to the yotta report page, credentials in the Google Doc',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://bayes.colorado.edu/statistics/yotta/' );
    }
  } );
  repo === 'skiffle' && modes.push( {
    name: 'sound board',
    description: 'Interactive HTML page for exploring existing sounds in sims and common code',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( '../skiffle/html/sound-board.html' );
    }
  } );
  repo === 'quake' && modes.push( {
    name: 'haptics playground (build for browser)',
    description: 'Built browser version of the Haptics Playground app',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( '../quake/platforms/browser/www/haptics-playground.html' );
    }
  } );

  // TODO: start from --- if ( repo === 'chipper' || repo === 'aqua' ) {

  modes.push( {
    name: 'github',
    description: 'Opens to the repository\'s GitHub main page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}` );
    }
  } );

  modes.push( {
    name: 'issues',
    description: 'Opens to the repository\'s GitHub issues page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}/issues` );
    }
  } );

  return modes;
};