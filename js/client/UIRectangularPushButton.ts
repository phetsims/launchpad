// Copyright 2025, University of Colorado Boulder

/**
 * RectangularPushButton with theming
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { rectangularButtonAppearanceStrategy, uiButtonBaseColorProperty } from './theme.js';

import { EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { RectangularPushButton, RectangularPushButtonOptions } from 'scenerystack/sun';

type SelfOptions = EmptySelfOptions;

export type UIRectangularPushButtonOptions = SelfOptions & RectangularPushButtonOptions;

export class UIRectangularPushButton extends RectangularPushButton {
  public constructor( providedOptions?: UIRectangularPushButtonOptions ) {
    const options = optionize<UIRectangularPushButtonOptions, SelfOptions, RectangularPushButtonOptions>()(
      {
        baseColor: uiButtonBaseColorProperty,
        xMargin: 5,
        yMargin: 5,
        buttonAppearanceStrategy: rectangularButtonAppearanceStrategy
      },
      providedOptions
    );

    super( options );
  }
}
