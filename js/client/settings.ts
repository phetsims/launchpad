// Copyright 2025, University of Colorado Boulder

/**
 * Global settings
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { LocalStorageBooleanProperty, LocalStorageEnumerationProperty } from './localStorage.js';
import { LaunchType } from './LaunchType.js';
import { RepoFilterType } from './RepoFilterType.js';

export const launchTypeProperty = new LocalStorageEnumerationProperty( 'launchType', LaunchType.SAME_TAB );
export const repoFilterTypeProperty = new LocalStorageEnumerationProperty( 'repoFilterType', RepoFilterType.ALL );
export const showAdvancedProperty = new LocalStorageBooleanProperty( 'showAdvanced', false );