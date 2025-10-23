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
  const studioPathSuffix = branchInfo.usesPhetioStudioIndex ? '' : `/${studioName}.html?sim=${branchInfo.repo}&${proxiesParams}`;
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
              return new EmptyCustomizationNode( `${releaseBranchPrefix}studio?sim=${repo}&phetioWrapperDebug=true&phetioElementsDisplay=all` );
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
      }
    }

    if ( branchInfo.branch === 'main' ) {
      if ( repoListEntry.supportsInteractiveDescription ) {
        modes.push( {
          name: 'a11y view (unbuilt)',
          description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content',
          createCustomizationNode: () => {
            return new EmptyCustomizationNode( `${releaseBranchPrefix}chipper/wrappers/a11y-view/?sim=${repo}&brand=phet&ea&debugger` );
          }
        } );

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

  modes.push( {
    name: 'github',
    description: 'Opens to the repository\'s GitHub main page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}` );
    }
  } );

  modes.push( {
    name: 'github issues',
    description: 'Opens to the repository\'s GitHub issues page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}/issues` );
    }
  } );

  return modes;
};