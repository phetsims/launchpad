// Copyright 2025, University of Colorado Boulder

/**
 * Enumeration for ways to filter repos
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Enumeration, EnumerationValue } from 'scenerystack/phet-core';

export class RepoFilterType extends EnumerationValue {
  public static readonly ALL = new RepoFilterType();
  public static readonly RUNNABLES = new RepoFilterType();
  public static readonly SIMULATIONS = new RepoFilterType();

  public static readonly enumeration = new Enumeration( RepoFilterType );
}