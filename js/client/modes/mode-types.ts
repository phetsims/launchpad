// Copyright 2025, University of Colorado Boulder

/**
 * Some types for modes
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import type { Node } from 'scenerystack/scenery';

export type CustomizationNode = Node & { getURL: () => string };

export type ModeData = {
  name: string;
  description: string;
  createCustomizationNode: () => CustomizationNode;
};
