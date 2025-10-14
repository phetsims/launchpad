// Copyright 2025, University of Colorado Boulder

/**
 * Returns the given modes and UIs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, RepoListEntry } from '../types/common-types.js';
import { Node } from 'scenerystack/scenery';

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

export const getModes = (
  repoListEntry: RepoListEntry,
  branchInfo: BranchInfo
): ModeData[] => {

  const repo = branchInfo.repo;
  const owner = repoListEntry.owner;

  const modes: ModeData[] = [];

  const versionString = branchInfo.version || '';

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
  const phetioBrandSuffix = usesChipper2 ? '' : '-phetio';
  const studioPathSuffix = branchInfo.usesPhetioStudioIndex ? '' : `/${studioName}.html?sim=${branchInfo.repo}&${proxiesParams}`;
  const phetioDevVersion = usesChipper2 ? versionString : versionString.split( '-' ).join( '-phetio' );

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
          // TODO: locale-specific versions perhaps?
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
            name: 'phet-io standalone unbuilt',
            description: 'Runs the unbuilt simulation in phet-io standalone mode',
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/${repo}_en.html?ea&brand=phet-io&${phetioStandaloneQueryParameters}&debugger` );
            }
          } );
        }

        if ( branchInfo.lastBuiltTime ) {
          modes.push( {
            name: 'phet-io standalone built',
            description: 'Runs the built simulation in phet-io standalone mode',
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/build${phetioFolder}/${repo}${phetioSuffix}.html?${phetioStandaloneQueryParameters}` );
            }
          } );
        }

        if ( branchInfo.branch === 'main' ) {
          modes.push( {
            name: 'phet-io studio unbuilt',
            description: `Runs the unbuilt simulation in ${studioNameBeautified}`,
            createCustomizationNode: () => {
              // TODO: likely this URL won't work for older cases
              return new EmptyCustomizationNode( `${releaseBranchPrefix}studio?sim=${branchInfo.repo}&phetioWrapperDebug=true&phetioElementsDisplay=all` );
            }
          } );
        }

        if ( branchInfo.lastBuiltTime ) {
          modes.push( {
            name: 'phet-io studio built',
            description: `Runs the built simulation in ${studioNameBeautified}`,
            createCustomizationNode: () => {
              return new EmptyCustomizationNode( `${repoDirectory}/build${phetioFolder}/wrappers/${studioName}${studioPathSuffix}` );
            }
          } );
        }
      }
    }

    if ( branchInfo.branch === 'main' ) {
      modes.push( {
        name: 'production latest',
        description: 'Runs latest production version',
        createCustomizationNode: () => {
          return new EmptyCustomizationNode( `https://phet.colorado.edu/sims/html/${branchInfo.repo}/latest/${branchInfo.repo}_all.html` );
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

  return modes;
};