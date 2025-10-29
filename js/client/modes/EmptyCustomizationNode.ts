// Copyright 2025, University of Colorado Boulder

/**
 * No customization, just a Node with a URL
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Node } from 'scenerystack/scenery';

export class EmptyCustomizationNode extends Node {
  public constructor(
    public url: string
  ) {
    super();
  }

  public getURL(): string {
    return this.url;
  }
}