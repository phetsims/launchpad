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

  if ( repoListEntry.isRunnable ) {
    // TODO: handle release branches also https://github.com/phetsims/phettest/issues/20

    modes.push( {
      name: 'unbuilt',
      description: 'Runs the simulation from the top-level development HTML in unbuilt mode',
      createCustomizationNode: () => {
        return new EmptyCustomizationNode( `${repo}/${repo}_en.html?ea&brand=phet&debugger` );
      }
    } );
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