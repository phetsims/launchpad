// Copyright 2025, University of Colorado Boulder

/**
 * Type for repo lists in launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export type Repo = string;
export type Branch = string;
export type SHA = string;
export type RepoBranch = {
  repo: Repo;
  branch: Branch;
};

export type RepoListEntry = {
  name: Repo;
  owner: string; // (from data/active-scenerystack-repos)
  isSim: boolean; // phet.simulation
  isRunnable: boolean; // phet.runnable
  supportsInteractiveDescription: boolean; // phet.simFeatures.supportsInteractiveDescription
  supportsVoicing: boolean; // phet.simFeatures.supportsVoicing
  hasUnitTests: boolean; // phet.generatedUnitTests
  branches: string[];
};

export type RepoList = RepoListEntry[];

export type ModelBranchInfo = {
  repo: Repo;
  branch: Branch;

  version: string | null;
  phetPackageJSON: PackageJSON[ 'phet' ] | null;
  brands: string[];
  isReleased: boolean;
  dependencyRepos: Repo[];

  isCheckedOut: boolean;
  currentBranch: Branch | null; // in normal operation, should be the branch name (but if hosting locally, can show warning)
  sha: SHA | null;
  timestamp: number | null;
  isClean: boolean;

  // Feature detection for links (for release branches)
  isChipper2: boolean;
  usesOldPhetioStandalone: boolean;
  usesRelativeSimPath: boolean;
  usesPhetioStudio: boolean;
  usesPhetioStudioIndex: boolean;

  buildJobID: number | null; // if it is a number, it is building currently
  lastBuiltTime: number | null;
  lastBuildSHAs: Record<Repo, SHA>;

  updateJobID: number | null; // if it is a number, it is updating currently
  lastUpdatedTime: number | null;

  npmUpdated: boolean;
};

export type BranchInfo = ModelBranchInfo & {
  dependencySHAMap: Record<Repo, SHA>;
  dependencyTimestampMap: Record<Repo, number>;
};

export type PackageJSON = {
  name: string;
  version: string;
  phet?: {
    runnable?: boolean;
    simulation?: boolean;
    generatedUnitTests?: boolean;
    supportsOutputJS?: boolean;
    requireJSNamespace?: string;
    'phet-io'?: {
      wrappers?: string[];
    };
    supportedBrands?: string[];
    simFeatures?: {
      supportsGestureControl?: boolean;
      supportsInteractiveDescription?: boolean;
      supportsVoicing?: boolean;
      supportsCoreVoicing?: boolean;
      supportsInteractiveHighlights?: boolean;
      supportsSound?: boolean;
      supportsExtraSound?: boolean;
      supportsDynamicLocale?: boolean;
      supportsPanAndZoom?: boolean;
      colorProfiles?: string[];
      supportedRegionsAndCultures?: string[];
      defaultRegionAndCulture?: string;
      preventMultitouch?: boolean;
      interruptMultitouch?: boolean;
    };
  };
};

export type LogEvent = {
  message: string;
  level: string;
  timestamp: string;
};

export type Commit = {
  sha: SHA;
  date: string; // ISO8601
  authorName: string;
  authorEmail: string;
  message: string;
};

export type QueryParameterType = 'boolean' | 'flag' | 'string' | 'number' | 'array' | 'custom';
export type QueryParameterSchema = {
  type: QueryParameterType;
  private?: boolean;
  public?: boolean;
  defaultValue?: unknown;
  validValues?: unknown[];
  elementSchema?: QueryParameterSchema; // for arrays
  separator?: string; // for arrays
};

export type QueryParameter = {
  name: string;
  doc: string;
  repo: string;
} & QueryParameterSchema;