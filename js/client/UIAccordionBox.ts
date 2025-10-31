// Copyright 2025, University of Colorado Boulder

/**
 * An AccordionBox with theming (collapsed by default)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Node } from 'scenerystack/scenery';
import { AccordionBox, AccordionBoxOptions } from 'scenerystack/sun';
import { uiBackgroundColorProperty } from './theme.js';
import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';

export class UIAccordionBox extends AccordionBox {
  public constructor( contentNode: Node, providedOptions?: AccordionBoxOptions ) {
    const options = optionize<AccordionBoxOptions, EmptySelfOptions>()( {
      expandedDefaultValue: false,
      titleAlignX: 'left',
      showTitleWhenExpanded: true,
      useExpandedBoundsWhenCollapsed: false,
      useContentWidthWhenCollapsed: false,
      titleBarExpandCollapse: true,
      stroke: null,
      fill: uiBackgroundColorProperty,
      buttonXMargin: 0
    }, providedOptions );

    super( contentNode, options );
  }

  public override dispose(): void {
    // TODO: Don't require this!!!! --- AccordionBox should note if it has no children, don't do layout then (even if it isn't disposed yet)
    // TODO: update to a new scenerystack version for this?
    // @ts-expect-error
    this.constraint.enabled = false;

    super.dispose();
  }
}