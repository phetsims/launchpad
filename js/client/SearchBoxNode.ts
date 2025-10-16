// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DerivedProperty, TProperty } from 'scenerystack/axon';
import { DOM, HBox } from 'scenerystack/scenery';
import { isDarkModeProperty, uiButtonBaseColorProperty } from './theme.js';

export class SearchBoxNode extends HBox {

  private readonly input: HTMLInputElement;

  public constructor( searchBoxTextProperty: TProperty<string> ) {

    const cssProperty = new DerivedProperty( [ isDarkModeProperty, uiButtonBaseColorProperty ], ( isDarkMode, buttonBaseColor ) => {
      return `width: 300px; border: 1px solid ${isDarkMode ? '#eee' : 'black'}; background: ${isDarkMode ? 'black' : 'white'}; color: ${isDarkMode ? 'white' : 'black'}; caret-color: ${isDarkMode ? '#999' : '#333'}; font: 16px sans-serif; padding: 4px;`;
    } );

    const input = document.createElement( 'input' );

    cssProperty.link( cssText => {
      input.style.cssText = cssText;
    } );
    input.type = 'text';
    input.placeholder = 'Search...';

    super( {
      spacing: 10,
      children: [
        new DOM( input, {
          allowInput: true
        } )
      ]
    } );

    this.input = input;

    input.addEventListener( 'input', () => {
      searchBoxTextProperty.value = input.value;
    } );
  }

  public focusSearchBox(): void {
    this.input.focus();
  }
}