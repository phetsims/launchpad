// Copyright 2025, University of Colorado Boulder

/**
 * Themed TextPushButton
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { TextPushButton, TextPushButtonOptions } from 'scenerystack/sun';
import { rectangularButtonAppearanceStrategy, uiButtonBaseColorProperty, uiButtonForegroundProperty, uiFont } from './theme.js';

type SelfOptions = EmptySelfOptions;

export type UITextPushButtonOptions = SelfOptions & TextPushButtonOptions;

export class UITextPushButton extends TextPushButton {
  public constructor( text: string, providedOptions?: UITextPushButtonOptions ) {
    const options = optionize<UITextPushButtonOptions, SelfOptions, TextPushButtonOptions>()(
      {
        textFill: uiButtonForegroundProperty,
        baseColor: uiButtonBaseColorProperty,
        xMargin: 5,
        yMargin: 5,
        font: uiFont,
        buttonAppearanceStrategy: rectangularButtonAppearanceStrategy
      },
      providedOptions
    );

    super( text, options );
  }
}
