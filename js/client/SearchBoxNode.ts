// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BooleanProperty, TProperty } from 'scenerystack/axon';
import { DOM, HBox } from 'scenerystack/scenery';
import { getInputCSSProperty } from './css.js';

export class SearchBoxNode extends HBox {

  public readonly isSearchBoxFocusedProperty = new BooleanProperty( false );
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

    input.addEventListener( 'focus', () => {
      this.isSearchBoxFocusedProperty.value = true;
      console.log( 'focused' );
    } );

    input.addEventListener( 'blur', () => {
      this.isSearchBoxFocusedProperty.value = false;
      console.log( 'blurred' );
    } );

    input.addEventListener( 'input', () => {
      searchBoxTextProperty.value = input.value;
    } );
  }

  public focusSearchBox(): void {
    this.input.focus();
  }
}