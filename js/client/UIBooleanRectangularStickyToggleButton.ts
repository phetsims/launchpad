// Copyright 2025, University of Colorado Boulder

/**
 * Themed BooleanRectangularStickyToggleButton
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { combineOptions, EmptySelfOptions, optionize } from 'scenerystack/phet-core';
import { BooleanRectangularStickyToggleButton, BooleanRectangularStickyToggleButtonOptions, ButtonInteractionState, TButtonAppearanceStrategyOptions } from 'scenerystack/sun';
import { uiButtonBaseColorProperty } from './theme.js';
import { TProperty, TReadOnlyProperty } from 'scenerystack/axon';
import { Color, PaintableNode, PaintColorProperty } from 'scenerystack/scenery';

type SelfOptions = EmptySelfOptions;

export type UIBooleanRectangularStickyToggleButtonOptions = SelfOptions & BooleanRectangularStickyToggleButtonOptions;

export class UIBooleanRectangularStickyToggleButton extends BooleanRectangularStickyToggleButton {
  public constructor( booleanProperty: TProperty<boolean>, providedOptions?: UIBooleanRectangularStickyToggleButtonOptions ) {
    const options = optionize<UIBooleanRectangularStickyToggleButtonOptions, SelfOptions, BooleanRectangularStickyToggleButtonOptions>()(
      {
        baseColor: uiButtonBaseColorProperty,
        xMargin: 3,
        yMargin: 3,
        buttonAppearanceStrategy: FlatToggleAppearanceStrategy
      },
      providedOptions
    );

    super( booleanProperty, options );
  }
}

export class FlatToggleAppearanceStrategy {

  public readonly maxLineWidth: number;

  private readonly disposeFlatAppearanceStrategy: () => void;

  /**
   * @param buttonBackground - the Node for the button's background, sans content
   * @param interactionStateProperty - interaction state, used to trigger updates
   * @param baseColorProperty - base color from which other colors are derived
   * @param [providedOptions]
   */
  public constructor( buttonBackground: PaintableNode,
                      interactionStateProperty: TReadOnlyProperty<ButtonInteractionState>,
                      baseColorProperty: TReadOnlyProperty<Color>,
                      providedOptions?: TButtonAppearanceStrategyOptions ) {

    // dynamic colors
    const baseBrighter4Property = new PaintColorProperty( baseColorProperty, { luminanceFactor: 0.4 } );
    const baseDarker4Property = new PaintColorProperty( baseColorProperty, { luminanceFactor: -0.4 } );

    // various fills that are used to alter the button's appearance
    const upFillProperty = baseColorProperty;
    const overFillProperty = baseBrighter4Property;
    const downFillProperty = baseDarker4Property;

    const options = combineOptions<TButtonAppearanceStrategyOptions>( {
      stroke: baseDarker4Property
    }, providedOptions );

    const lineWidth = typeof options.lineWidth === 'number' ? options.lineWidth : 1;

    // If the stroke wasn't provided, set a default.
    buttonBackground.stroke = options.stroke || baseDarker4Property;
    buttonBackground.lineWidth = lineWidth;

    this.maxLineWidth = buttonBackground.hasStroke() ? lineWidth : 0;

    // Cache colors
    buttonBackground.cachedPaints = [ upFillProperty, overFillProperty, downFillProperty ];

    // Change colors to match interactionState
    function interactionStateListener( interactionState: ButtonInteractionState ): void {
      switch( interactionState ) {

        case ButtonInteractionState.IDLE:
          buttonBackground.fill = uiButtonBaseColorProperty;
          buttonBackground.opacity = 0.2;
          break;

        case ButtonInteractionState.OVER:
          buttonBackground.fill = uiButtonBaseColorProperty;
          buttonBackground.opacity = 0.4;
          break;

        case ButtonInteractionState.PRESSED:
          // buttonBackground.fill = downFillProperty;
          buttonBackground.fill = uiButtonBaseColorProperty;
          buttonBackground.opacity = 1;
          break;

        default:
          throw new Error( `unsupported interactionState: ${interactionState}` );
      }
    }

    // Do the initial update explicitly, then lazy link to the properties.  This keeps the number of initial updates to
    // a minimum and allows us to update some optimization flags the first time the base color is actually changed.
    interactionStateProperty.link( interactionStateListener );

    this.disposeFlatAppearanceStrategy = () => {
      if ( interactionStateProperty.hasListener( interactionStateListener ) ) {
        interactionStateProperty.unlink( interactionStateListener );
      }
      baseBrighter4Property.dispose();
      baseDarker4Property.dispose();
    };
  }

  public dispose(): void {
    this.disposeFlatAppearanceStrategy();
  }
}