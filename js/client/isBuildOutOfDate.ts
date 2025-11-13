// Copyright 2025, University of Colorado Boulder

/**
 * Determines whether a build is buildable with new SHAs.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo } from '../types/common-types.js';

export const isBuildOutOfDate = (
  branchInfo: BranchInfo
): boolean => {
  let outOfDate: boolean;
  if ( !branchInfo.lastBuiltTime ) {
    outOfDate = true;
  }
  else if ( branchInfo.branch === 'main' ) {
    outOfDate = !branchInfo.dependencyRepos.every( dependencyRepo => {
      if ( !( dependencyRepo in branchInfo.dependencySHAMap ) ) {
        return false;
      }
      const localSHA = branchInfo.dependencySHAMap[ dependencyRepo ];
      const latestBuildSHA = branchInfo.lastBuildSHAs[ dependencyRepo ];

      return localSHA === latestBuildSHA;
    } );
  }
  else {
    outOfDate = branchInfo.sha !== branchInfo.lastBuildSHAs[ branchInfo.repo ];
  }

  return outOfDate;
};