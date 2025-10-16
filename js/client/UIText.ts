// Copyright 2025, University of Colorado Boulder

/**
 * Themed Text
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TReadOnlyProperty } from 'scenerystack/axon';
import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { Text, TextOptions } from 'scenerystack/scenery';
import { uiFont, uiForegroundColorProperty } from './theme.js';

export type UITextOptions = TextOptions;

export class UIText extends Text {
  public constructor( string: string | number | TReadOnlyProperty<string>, providedOptions?: UITextOptions ) {
    const options = optionize<UITextOptions, EmptySelfOptions, TextOptions>()(
      {
        font: uiFont,
        fill: uiForegroundColorProperty
      },
      providedOptions
    );

    super( string, options );
  }
}
