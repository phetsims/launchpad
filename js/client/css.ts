// Copyright 2025, University of Colorado Boulder

/**
 * CSS needed for elements
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DerivedProperty, TReadOnlyProperty } from 'scenerystack/axon';
import { isDarkModeProperty } from './theme.js';

export const getInputCSSProperty = (
  width: number,
  options?: { padding?: number }
): TReadOnlyProperty<string> => {
  const padding = options?.padding ?? 4;

  return new DerivedProperty( [ isDarkModeProperty ], isDarkMode => {
    return `width: ${width}px; border: 1px solid ${isDarkMode ? '#eee' : 'black'}; background: ${isDarkMode ? 'black' : 'white'}; color: ${isDarkMode ? 'white' : 'black'}; caret-color: ${isDarkMode ? '#999' : '#333'}; font: 16px sans-serif; padding: ${padding}px;`;
  } );
};