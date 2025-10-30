// Copyright 2025, University of Colorado Boulder

/**
 * Theme
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BooleanProperty, DerivedProperty2 } from 'scenerystack/axon';
import { Color, Font, PaintDef, TColor } from 'scenerystack/scenery';
import { Enumeration, EnumerationValue, platform } from 'scenerystack/phet-core';
import { LocalStorageEnumerationProperty } from './localStorage.js';
import { ColorConstants, RectangularButton } from 'scenerystack/sun';

export class ColorTheme extends EnumerationValue {
  public static readonly AUTO = new ColorTheme();
  public static readonly LIGHT = new ColorTheme();
  public static readonly DARK = new ColorTheme();

  public static readonly enumeration = new Enumeration( ColorTheme );
}

const mediaQueryList = window.matchMedia( '(prefers-color-scheme: dark)' );

export const isOSDarkModeProperty = new BooleanProperty( mediaQueryList.matches );
mediaQueryList.addEventListener( 'change', e => {
  isOSDarkModeProperty.value = e.matches;
} );

export const colorThemeProperty = new LocalStorageEnumerationProperty( 'colorTheme', ColorTheme.AUTO );

export const isDarkModeProperty = new DerivedProperty2(
  [ isOSDarkModeProperty, colorThemeProperty ],
  ( isDark, colorTheme ) => {
    return colorTheme === ColorTheme.DARK || ( colorTheme === ColorTheme.AUTO && isDark );
  } );

class LightDarkColorProperty extends DerivedProperty2<Color, boolean, ColorTheme> {
  public constructor(
    public readonly lightColor: TColor,
    public readonly darkColor: TColor
  ) {
    super(
      [ isOSDarkModeProperty, colorThemeProperty ],
      ( isDark, colorTheme ) => {
        const useDark = colorTheme === ColorTheme.DARK || ( colorTheme === ColorTheme.AUTO && isDark );

        return PaintDef.toColor(
          useDark ? darkColor : lightColor
        );
      }
    );
  }
}

export const uiFontFamily = platform.firefox ? 'Arial, sans-serif' : 'Helvetica, Arial, sans-serif';

export const uiFont = new Font( {
  family: uiFontFamily,
  size: 16
} );

export const uiHeaderFont = new Font( {
  family: uiFontFamily,
  size: 24
} );

export const uiRepoNameFont = new Font( {
  family: uiFontFamily,
  size: 30,
  weight: 'bold'
} );

export const buildOutputFont = new Font( {
  family: uiFontFamily,
  size: 12
} );

export const queryParameterDocFont = new Font( {
  family: uiFontFamily,
  size: 12
} );

const useFlatButtons = true;
export const rectangularButtonAppearanceStrategy =
  useFlatButtons ? RectangularButton.FlatAppearanceStrategy : RectangularButton.ThreeDAppearanceStrategy;

export const uiBackgroundColorProperty = new LightDarkColorProperty(
  '#eee',
  '#282828'
);
export const uiForegroundColorProperty = new LightDarkColorProperty(
  '#000',
  'rgb(204,204,204)'
);

export const uiButtonBaseColorProperty = new LightDarkColorProperty(
  ColorConstants.LIGHT_BLUE,
  '#99CEFF'
);
export const uiButtonForegroundProperty = new LightDarkColorProperty(
  'rgb(0,0,0)',
  'rgb(0,0,0)'
);
export const uiButtonDisabledColorProperty = new LightDarkColorProperty(
  'rgb(220,220,220)',
  'rgb(128,128,128)'
);

export const linkColorProperty = new LightDarkColorProperty(
  '#00f',
  '#6cf'
);

export const autocompleteMatchColorProperty = new LightDarkColorProperty(
  '#02a',
  '#6cf'
);

export const listHoverColorProperty = new LightDarkColorProperty(
  '#ccc',
  '#333'
);
export const listEvenColorProperty = new LightDarkColorProperty(
  '#ddd',
  '#111'
);
export const listOddColorProperty = new LightDarkColorProperty(
  '#eee',
  '#222'
);
export const listSelectedColorProperty = new LightDarkColorProperty(
  '#9cf',
  '#235680'
);

export const barrierColorProperty = new LightDarkColorProperty(
  'rgba(127,127,127,0.7)',
  'rgba(60,60,60,0.7)'
);

export const keyFillColorProperty = new LightDarkColorProperty(
  '#fff',
  '#555'
);
export const keyShadowColorProperty = new LightDarkColorProperty(
  '#000',
  '#181818'
);
export const keyTextColorProperty = new LightDarkColorProperty(
  '#000',
  '#eee'
);