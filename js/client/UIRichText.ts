// Copyright 2025, University of Colorado Boulder

/**
 * Themed RichText
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TReadOnlyProperty } from 'scenerystack/axon';
import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { RichText, RichTextOptions } from 'scenerystack/scenery';
import { uiFont, uiForegroundColorProperty } from './theme.js';

export type UIRichTextOptions = RichTextOptions;

export class UIRichText extends RichText {
  public constructor( string: string | number | TReadOnlyProperty<string>, providedOptions?: UIRichTextOptions ) {
    const options = optionize<UIRichTextOptions, EmptySelfOptions, RichTextOptions>()(
      {
        font: uiFont,
        fill: uiForegroundColorProperty,
        replaceNewlines: true
      },
      providedOptions
    );

    super( string, options );
  }
}
