// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TProperty } from 'scenerystack/axon';
import { DOM, HBox } from 'scenerystack/scenery';

export class SearchBoxNode extends HBox {

  private readonly input: HTMLInputElement;

  public constructor( searchBoxTextProperty: TProperty<string> ) {
    const input = document.createElement( 'input' );
    input.style.cssText = 'width: 300px; border: 1px solid black; font: 16px sans-serif; padding: 4px;';
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