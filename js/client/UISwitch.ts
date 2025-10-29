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
  onOffSwitchOptions?: OnOffSwitchOptions;

  reversedColors?: boolean;
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
        // checkboxColor: uiForegroundColorProperty,
        // checkboxColorBackground: uiBackgroundColorProperty,
        onOffSwitchOptions: {
          size: new Dimension2( 40, 20 ),
          trackFillLeft: uiButtonDisabledColorProperty,
          trackFillRight: uiButtonBaseColorProperty,
          accessibleName: name
        },

        reversedColors: false,

        spacing: 10
      },
      providedOptions
    );

    if ( options.reversedColors ) {
      options.onOffSwitchOptions.trackFillLeft = uiButtonBaseColorProperty;
      options.onOffSwitchOptions.trackFillRight = uiButtonDisabledColorProperty;
    }

    const onOffSwitch = new OnOffSwitch( property, options.onOffSwitchOptions );

    options.children = [ content, onOffSwitch ];

    super( options );
  }
}
