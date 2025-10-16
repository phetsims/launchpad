// Copyright 2025, University of Colorado Boulder

/**
 * AquaRadioButtonGroup with UI theming
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property } from 'scenerystack/axon';
import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { AquaRadioButtonGroup, AquaRadioButtonGroupItem, AquaRadioButtonGroupOptions } from 'scenerystack/sun';
import { uiBackgroundColorProperty, uiButtonBaseColorProperty, uiForegroundColorProperty } from './theme.js';

export type UIAquaRadioButtonGroupOptions = AquaRadioButtonGroupOptions;

export class UIAquaRadioButtonGroup<T> extends AquaRadioButtonGroup<T> {
  public constructor(
    property: Property<T>,
    items: AquaRadioButtonGroupItem<T>[],
    providedOptions?: AquaRadioButtonGroupOptions
  ) {
    const options = optionize<AquaRadioButtonGroupOptions, EmptySelfOptions>()(
      {
        spacing: 8,
        radioButtonOptions: {
          selectedColor: uiButtonBaseColorProperty,
          deselectedColor: uiBackgroundColorProperty,
          stroke: uiForegroundColorProperty
        }
      },
      providedOptions
    );

    super( property, items, options );
  }
}
