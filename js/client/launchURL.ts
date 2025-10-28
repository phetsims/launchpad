// Copyright 2025, University of Colorado Boulder

/**
 * Launches a URL according to user preference (same tab or new tab)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { launchTypeProperty } from './settings.js';
import { LaunchType } from './LaunchType.js';

export const launchURL = ( url: string ): void => {
  const launchType = launchTypeProperty.value;

  if ( launchType === LaunchType.SAME_TAB ) {
    window.location.href = url;
  }
  else if ( launchType === LaunchType.NEW_TAB ) {
    const popupWindow = window.open( url, '_blank' );
    popupWindow && popupWindow.focus();
  }
};
