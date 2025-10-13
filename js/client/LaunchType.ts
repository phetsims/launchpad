// Copyright 2025, University of Colorado Boulder

/**
 * Enumeration for ways to launch links
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Enumeration, EnumerationValue } from 'scenerystack/phet-core';

export class LaunchType extends EnumerationValue {
  public static readonly SAME_TAB = new LaunchType();
  public static readonly NEW_TAB = new LaunchType();

  public static readonly enumeration = new Enumeration( LaunchType );
}