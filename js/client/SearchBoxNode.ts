// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TProperty } from 'scenerystack/axon';
import { DOM, HBox } from 'scenerystack/scenery';
import { getInputCSSProperty } from './css.js';

export class SearchBoxNode extends HBox {

  private readonly input: HTMLInputElement;

  public constructor( searchBoxTextProperty: TProperty<string> ) {

    const input = document.createElement( 'input' );

    getInputCSSProperty( 300 ).link( cssText => {
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