// Copyright 2025, University of Colorado Boulder

/**
 * Themed text checkbox
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property } from 'scenerystack/axon';
import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { Checkbox, CheckboxOptions } from 'scenerystack/sun';
import { uiBackgroundColorProperty, uiForegroundColorProperty } from './theme.js';
import { UIText } from './UIText.js';

type SelfOptions = EmptySelfOptions;

export type UITextCheckboxOptions = SelfOptions & CheckboxOptions;

export class UITextCheckbox extends Checkbox {
  public constructor( label: string, property: Property<boolean>, providedOptions?: UITextCheckboxOptions ) {
    const options = optionize<UITextCheckboxOptions, SelfOptions, CheckboxOptions>()(
      {
        accessibleName: label,
        checkboxColor: uiForegroundColorProperty,
        checkboxColorBackground: uiBackgroundColorProperty
      },
      providedOptions
    );

    const labelNode = new UIText( label );

    options.boxWidth = labelNode.height;

    super( property, labelNode, options );
  }
}
