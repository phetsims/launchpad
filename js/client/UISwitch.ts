// Copyright 2025, University of Colorado Boulder

/**
 * Themed Switch
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TReadOnlyProperty } from 'scenerystack/axon';
import { Dimension2 } from 'scenerystack/dot';
import { optionize } from 'scenerystack/phet-core';
import { HBox, HBoxOptions, Node } from 'scenerystack/scenery';
import { OnOffSwitch, OnOffSwitchOptions } from 'scenerystack/sun';
import { uiButtonBaseColorProperty, uiButtonDisabledColorProperty } from './theme.js';

type SelfOptions = {
  // If it is advanced, will only be visible when advancedSettingsVisibleProperty is true
  advanced?: boolean;

  onOffSwitchOptions?: OnOffSwitchOptions;
};

export type UISwitchOptions = SelfOptions & HBoxOptions;

export class UISwitch extends HBox {
  public constructor(
    property: Property<boolean>,
    name: string | TReadOnlyProperty<string>,
    content: Node,
    providedOptions?: UISwitchOptions
  ) {
    const options = optionize<UISwitchOptions, SelfOptions, HBoxOptions>()(
      {
        advanced: false,
        // checkboxColor: uiForegroundColorProperty,
        // checkboxColorBackground: uiBackgroundColorProperty,
        onOffSwitchOptions: {
          size: new Dimension2( 40, 20 ),
          trackFillLeft: uiButtonDisabledColorProperty,
          trackFillRight: uiButtonBaseColorProperty,
          accessibleName: name
        },

        spacing: 10
      },
      providedOptions
    );

    const onOffSwitch = new OnOffSwitch( property, options.onOffSwitchOptions );

    options.children = [ content, onOffSwitch ];

    super( options );
  }
}
