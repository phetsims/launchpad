// Copyright 2025, University of Colorado Boulder

/**
 * Model type for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import fs from 'fs';
import type { Branch, ModelBranchInfo, Repo } from '../types/common-types.js';

export type Model = {
  repos: Record<Repo, {
    name: Repo;
    owner: string; // (from data/active-scenerystack-repos)
    isSim: boolean; // phet.simulation
    isRunnable: boolean; // phet.runnable
    supportsInteractiveDescription: boolean; // phet.simFeatures.supportsInteractiveDescription
    supportsVoicing: boolean; // phet.simFeatures.supportsVoicing
    hasUnitTests: boolean; // phet.generatedUnitTests

    branches: Record<Branch, ModelBranchInfo>;
  }>;
};


const getEmptyModel = (): Model => {
  return {
    repos: {}
  };
};


export const model = fs.existsSync( '.model.json' ) ? JSON.parse( fs.readFileSync( '.model.json', 'utf8' ) ) as Model : getEmptyModel();

// Reset some state on startup
for ( const repo of Object.keys( model.repos ) ) {
  for ( const branch of Object.keys( model.repos[ repo ].branches ) ) {
    model.repos[ repo ].branches[ branch ].buildJobID = null; // reset any in-progress builds
    model.repos[ repo ].branches[ branch ].updateCheckoutJobID = null; // reset any in-progress updates
  }
}

export const saveModel = (): void => {
  fs.writeFileSync( '.model.json', JSON.stringify( model, null, 2 ), 'utf8' );
};