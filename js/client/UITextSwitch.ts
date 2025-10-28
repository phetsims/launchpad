// Copyright 2025, University of Colorado Boulder

/**
 * Themed Text Switch
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TReadOnlyProperty } from 'scenerystack/axon';
import { optionize } from 'scenerystack/phet-core';
import { UIText, UITextOptions } from './UIText.js';
import { UISwitch, UISwitchOptions } from './UISwitch.js';

type SelfOptions = {
  textOptions?: UITextOptions;
};

export type UITextSwitchOptions = SelfOptions & UISwitchOptions;

export class UITextSwitch extends UISwitch {
  public constructor(
    property: Property<boolean>,
    name: string | TReadOnlyProperty<string>,
    providedOptions?: UITextSwitchOptions
  ) {
    const options = optionize<UITextSwitchOptions, SelfOptions, UISwitchOptions>()(
      {
        textOptions: {}
      },
      providedOptions
    );

    const text = new UIText( name, options.textOptions );

    super( property, name, text, options );
  }
}
