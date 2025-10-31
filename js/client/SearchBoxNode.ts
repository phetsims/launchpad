// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TProperty } from 'scenerystack/axon';
import { getInputCSSProperty } from './css.js';
import { optionize, StrictOmit } from 'scenerystack/phet-core';
import { FocusableDOMNode, FocusableDOMOptions } from './FocusableDOMNode.js';

type SelfOptions = {
  searchBoxAccessibleName?: string;
};

export type SearchBoxNodeOptions = SelfOptions & StrictOmit<FocusableDOMOptions, 'tagName'>;

export class SearchBoxNode extends FocusableDOMNode {

  public constructor( searchBoxTextProperty: TProperty<string>, providedOptions?: SearchBoxNodeOptions ) {

    const options = optionize<SearchBoxNodeOptions, SelfOptions, FocusableDOMOptions>()( {
      searchBoxAccessibleName: 'Search Box',
      tagName: 'input',
      inputType: 'text'
    }, providedOptions );

    options.accessibleName = options.searchBoxAccessibleName;

    const input = document.createElement( 'input' );

    getInputCSSProperty( 300 ).link( cssText => {
      input.style.cssText = cssText;
    } );
    input.type = 'text';
    input.placeholder = 'Search...';
    input.ariaLabel = options.searchBoxAccessibleName;

    super( input, options );

    input.addEventListener( 'input', () => {
      searchBoxTextProperty.value = input.value;
    } );
  }
}