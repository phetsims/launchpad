// Copyright 2025, University of Colorado Boulder

/**
 * Returns the given modes and UIs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, Repo, RepoListEntry } from '../types/common-types.js';
import { HBox, Node } from 'scenerystack/scenery';
import { WaitingNode } from './WaitingNode.js';
import { ViewContext } from './ViewContext.js';
import { UIText } from './UIText.js';
import { DatedVersion, getDevVersions, getProductionVersions } from './fileListings.js';
import { UIAquaRadioButtonGroup } from './UIAquaRadioButtonGroup.js';
import { Property } from 'scenerystack/axon';
import moment from 'moment';

export type CustomizationNode = Node & { getURL: () => string };

export type ModeData = {
  name: string;
  description: string;
  createCustomizationNode: () => CustomizationNode;
};

class EmptyCustomizationNode extends Node {
  public constructor(
    public url: string
  ) {
    super();
  }

  public getURL(): string {
    return this.url;
  }
}

class VersionListingCustomizationNode extends Node {

  private readonly versionProperty!: Property<string>;

  public constructor(
    public readonly repo: Repo,
    datedVersionsPromise: Promise<DatedVersion[]>,
    private versionStringToURL: ( versionString: string ) => string,
    defaultName: string,
    defaultLabel: string,
    viewContext: ViewContext
  ) {
    super();

    this.versionProperty = new Property( defaultName );

    const waitingNode = new WaitingNode( viewContext );

    this.addDisposable( waitingNode );

    this.children = [
      new HBox( {
        spacing: 10,
        children: [
          new UIText( 'Loading versions...' ),
          waitingNode
        ]
      } )
    ];

    ( async () => {
      const datedVersions = await datedVersionsPromise;

      datedVersions.sort( ( a, b ) => -a.simVersion.compareNumber( b.simVersion ) );

      this.children = [
        new UIAquaRadioButtonGroup( this.versionProperty, [
          {
            value: defaultName,
            createNode: () => new UIText( defaultLabel )
          },
          ...datedVersions.map( datedVersion => {
            return {
              value: datedVersion.simVersion.toString(),
              createNode: () => new UIText( `${datedVersion.simVersion.toString()} (${moment( datedVersion.date ).calendar()})` )
            };
          } )
        ] )
      ];
    } )().catch( e => { throw e; } );
  }

  public getURL(): string {
    return this.versionStringToURL( this.versionProperty.value );
  }
}

class ProductionCustomizationNode extends VersionListingCustomizationNode {
  public constructor( repo: Repo, viewContext: ViewContext ) {
    super(
      repo,
      getProductionVersions( repo ),
      version => `https://phet.colorado.edu/sims/html/${repo}/${version}/${repo}_all.html`,
      'latest',
      'latest',
      viewContext
    );
  }
}

class DevCustomizationNode extends VersionListingCustomizationNode {
  public constructor( repo: Repo, viewContext: ViewContext ) {
    super(
      repo,
      getDevVersions( repo ),
      // TODO: Better URL for launching? or just better to show that directory?
      version => version === 'base' ? `https://phet-dev.colorado.edu/html/${repo}/` : `https://phet-dev.colorado.edu/html/${repo}/${version}/`,
      'base',
      '(root directory)',
      viewContext
    );
  }
}

export const getModes = (
  repoListEntry: RepoListEntry,
  branchInfo: BranchInfo,
  viewContext: ViewContext
): ModeData[] => {

  const repo = branchInfo.repo;
  const owner = repoListEntry.owner;

  const modes: ModeData[] = [];

  // const versionString = branchInfo.version || '';

  const releaseBranchPrefix = branchInfo.branch === 'main' ? '' : `release-branches/${branchInfo.repo}-${branchInfo.branch}/`;
  const repoDirectory = `${releaseBranchPrefix}${repo}`;

  const phetioStandaloneQueryParameters = branchInfo.usesOldPhetioStandalone ? 'phet-io.standalone' : 'phetioStandalone';
  const proxiesParams = branchInfo.usesRelativeSimPath ? 'relativeSimPath' : 'launchLocalVersion';
  const studioName = branchInfo.brands.includes( 'phet-io' ) && branchInfo.usesPhetioStudio ? 'studio' : 'instance-proxies';
  const studioNameBeautified = studioName === 'studio' ? 'Studio' : 'Instance Proxies';
  const usesChipper2 = branchInfo.isChipper2;
  const phetFolder = usesChipper2 ? '/phet' : '';
  const phetioFolder = usesChipper2 ? '/phet-io' : '';
  const phetSuffix = usesChipper2 ? '_phet' : '';
  const phetioSuffix = usesChipper2 ? '_all_phet-io' : '_en-phetio';
  // const phetioBrandSuffix = usesChipper2 ? '' : '-phetio';
  const studioPathSuffix = branchInfo.usesPhetioStudioIndex ? '/' : `/${studioName}.html?sim=${branchInfo.repo}&${proxiesParams}`;
  // const phetioDevVersion = usesChipper2 ? versionString : versionString.split( '-' ).join( '-phetio' );

  // `](https://phet-dev.colorado.edu/html/${this.repo}/${versionString}${phetFolder}/${this.repo}_all${phetSuffix}.html)`

  if ( repoListEntry.isRunnable ) {
    // TODO: handle release branches also https://github.com/phetsims/phettest/issues/20

    if ( branchInfo.isCheckedOut ) {
      if ( branchInfo.branch === 'main' ) {
        modes.push( {
          name: 'unbuilt',
          description: 'Runs the simulation from the top-level development HTML in unbuilt mode',
          createCustomizationNode: () => {
            return new EmptyCustomizationNode( `${repoDirectory}/${repo}_en.html?ea&brand=phet&debugger` );
          }
        } );
      }

      if ( branchInfo.lastBuiltTime ) {
        modes.push( {
          // TODO: locale-specific versions perhaps? https://github.com/phetsims/phettest/issues/20
          name: 'built',
          description: 'Runs the simulation from the built all-locale HTML',
          createCustomizationNode: () => {
            return new EmptyCustomizationNode( `${repoDirectory}/build${phetFolder}/${repo}_all${phetSuffix}.html` );
          }
        } );
      }

      if ( branchInfo.brands.includes( 'phet-io' ) ) {
        if ( branchInfo.branch === 'main' ) {
          modes.push( {
            name: 'studio (phet-io unbuilt)',
            description: `Runs the unbuilt simulation in ${studioNameBeautified}`,
            createCustomizationNode: () => {
              // TODO: likely this URL won't work for older cases https://github.com/phetsims/phettest/issues/20
              return new EmptyCustomizationNode( `${releaseBranchPrefix}studio/?sim=${repo}&phetioWrapperDebug=true&phetioElementsDisplay=all` );
            }
          } );
        }

        if ( branchInfo.lastBuiltTime ) {
          modes.push( {
            name: 'studio (phet-io built)',
            description: `Runs the built simulation in ${studioNameBeautified}`,
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/build${phetioFolder}/wrappers/${studioName}${studioPathSuffix}` );
            }
          } );
        }

        if ( branchInfo.branch === 'main' ) {
          modes.push( {
            name: 'standalone (phet-io unbuilt)',
            description: 'Runs the unbuilt simulation in phet-io standalone mode',
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/${repo}_en.html?ea&brand=phet-io&${phetioStandaloneQueryParameters}&debugger` );
            }
          } );
        }

        if ( branchInfo.lastBuiltTime ) {
          modes.push( {
            name: 'standalone (phet-io built)',
            description: 'Runs the built simulation in phet-io standalone mode',
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/build${phetioFolder}/${repo}${phetioSuffix}.html?${phetioStandaloneQueryParameters}` );
            }
          } );
        }

        if ( branchInfo.lastBuiltTime ) {
          // Add a link to the compiled wrapper index;
          modes.push( {
            name: 'index (phet-io built)',
            description: 'Runs the PhET-iO wrapper index from build/ directory (built from chipper)',
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/build${phetioFolder}/` );
            }
          } );
        }
      }
    }

    if ( repoListEntry.supportsInteractiveDescription ) {
      if ( branchInfo.branch === 'main' ) {
        modes.push( {
          name: 'a11y view (unbuilt)',
          description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content',
          createCustomizationNode: () => {
            return new EmptyCustomizationNode( `${releaseBranchPrefix}chipper/wrappers/a11y-view/?sim=${repo}&brand=phet&ea&debugger` );
          }
        } );
      }

      if ( branchInfo.lastBuiltTime ) {
        modes.push( {
          name: 'a11y view (built)',
          description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content',
          createCustomizationNode: () => {
            return new EmptyCustomizationNode( `${repoDirectory}/build${phetFolder}/${repo}_a11y_view.html` );
          }
        } );
      }
    }

    if ( branchInfo.lastBuiltTime ) {
      modes.push( {
        name: 'xhtml (built)',
        description: 'Runs the built simulation XHTML',
        createCustomizationNode: () => {
          return new EmptyCustomizationNode( `${repoDirectory}/build${phetFolder}/xhtml/${repo}_all.xhtml` );
        }
      } );
    }

    if ( branchInfo.branch === 'main' ) {
      modes.push( {
        name: 'color editor',
        description: 'Runs the top-level -colors.html file (allows editing/viewing different profile colors)',
        createCustomizationNode: () => {
          return new EmptyCustomizationNode( `${releaseBranchPrefix}phetmarks/color-editor.html?sim=${repo}` );
        }
      } );

      modes.push( {
        name: 'production',
        description: 'Runs production versions (defaults to the latest)',
        createCustomizationNode: () => {
          return new ProductionCustomizationNode( repo, viewContext );
        }
      } );

      modes.push( {
        name: 'dev (bayes)',
        description: 'Loads the location on phet-dev.colorado.edu with versions for each dev deploy',
        createCustomizationNode: () => {
          return new DevCustomizationNode( repo, viewContext );
        }
      } );
    }
  }

  if ( repo === 'phet-io' ) {
    // modes.push( {
    //   name: 'fuzz-test studio wrapper',
    //   description: 'Runs automated testing with fuzzing on studio, 15 second timer',
    //   createCustomizationNode: () => {
    //     return new EmptyCustomizationNode( `../aqua/fuzz-lightyear/?fuzz&wrapperName=studio&wrapperContinuousTest=%7B%7D&repos=${TODO phetio sims joined by comma}` );
    //   }
    // } );
    // modes.push( {
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
    // modes.push( {
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
  }

  if ( repo === 'phet-io-website' ) {
    modes.push( {
      name: 'view local',
      description: 'view the local root of the website',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( `${releaseBranchPrefix}phet-io-website/root/` );
      }
    } );
  }

  if ( repoListEntry.hasUnitTests ) {
    modes.push( {
      name: 'unit tests (unbuilt)',
      description: 'Runs unit tests in unbuilt mode',
      createCustomizationNode: () => {
        // TODO: provide phet-io brand if phet-io/tandem/phet-io-wrappers?
        return new EmptyCustomizationNode( `${repoDirectory}/${repo}-tests.html` );
      }
    } );
  }

  if ( [ 'phet-io', 'binder' ].includes( repo ) ) {
    modes.push( {
      name: 'documentation',
      description: 'Browse HTML documentation',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( `${repoDirectory}/doc${repo === 'binder' ? 's' : ''}/` );
      }
    } );
  }

  if ( repo === 'scenery' ) {
    modes.push( {
      name: 'basics documentation',
      description: 'Scenery Basics Documentation',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-basics/' );
      }
    } );
    modes.push( {
      name: 'layout documentation',
      description: 'Scenery Layout Documentation',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-layout/' );
      }
    } );
    modes.push( {
      name: 'input documentation',
      description: 'Scenery Input Documentation',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-input/' );
      }
    } );
    modes.push( {
      name: 'accessibility documentation',
      description: 'Scenery Accessibility Documentation',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-accessibility/' );
      }
    } );
  }

  if ( repo === 'scenery' || repo === 'kite' || repo === 'dot' || repo === 'phet-core' || repo === 'alpenglow' ) {
    modes.push( {
      name: 'playground',
      description: `Loads ${repo} and dependencies in the tab, and allows quick testing`,
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( `${repoDirectory}/tests/playground.html` );
      }
    } );
  }

  if ( repo === 'scenery' ) {
    modes.push( {
      name: 'sandbox',
      description: 'Allows quick testing of Scenery features',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( `${repoDirectory}/tests/sandbox.html` );
      }
    } );
  }

  if ( repo === 'yotta' ) {
    modes.push( {
      name: 'statistics page',
      description: 'Goes to the yotta report page, credentials in the Google Doc',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( 'https://bayes.colorado.edu/statistics/yotta/' );
      }
    } );
  }
  if ( repo === 'skiffle' ) {
    modes.push( {
      name: 'sound board',
      description: 'Interactive HTML page for exploring existing sounds in sims and common code',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( '../skiffle/html/sound-board.html' );
      }
    } );
  }
  if ( repo === 'quake' ) {
    modes.push( {
      name: 'haptics playground (build for browser)',
      description: 'Built browser version of the Haptics Playground app',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( '../quake/platforms/browser/www/haptics-playground.html' );
      }
    } );
  }

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