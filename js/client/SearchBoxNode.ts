// Copyright 2025, University of Colorado Boulder

/**
 * Search box for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BooleanProperty, TProperty } from 'scenerystack/axon';
import { DOM, HBox, HBoxOptions, PDOMUtils } from 'scenerystack/scenery';
import { getInputCSSProperty } from './css.js';
import { optionize, StrictOmit } from 'scenerystack/phet-core';

type SelfOptions = {
  searchBoxAccessibleName?: string;
};

export type SearchBoxNodeOptions = SelfOptions & StrictOmit<HBoxOptions, 'children'>;

export class SearchBoxNode extends HBox {

  public readonly isSearchBoxFocusedProperty = new BooleanProperty( false );
  private readonly input: HTMLInputElement;

  public constructor( searchBoxTextProperty: TProperty<string>, providedOptions?: SearchBoxNodeOptions ) {

    const options = optionize<SearchBoxNodeOptions, SelfOptions, HBoxOptions>()( {
      spacing: 10,
      searchBoxAccessibleName: 'Search Box'
    }, providedOptions );

    const input = document.createElement( 'input' );

    getInputCSSProperty( 300 ).link( cssText => {
      input.style.cssText = cssText;
    } );
    input.type = 'text';
    input.placeholder = 'Search...';
    input.ariaLabel = options.searchBoxAccessibleName;

    const div = document.createElement( 'div' );

    const beforeDiv = document.createElement( 'div' );
    const afterDiv = document.createElement( 'div' );

    div.appendChild( beforeDiv );
    div.appendChild( input );
    div.appendChild( afterDiv );

    const dom = new DOM( div, {
      allowInput: true,
      tagName: 'input',
      inputType: 'text',
      accessibleName: options.searchBoxAccessibleName
    } );

    dom.addInputListener( {
      focus: () => {
        input.focus();
      }
    } );

    options.children = [ dom ];

    super( options );

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

    this.isSearchBoxFocusedProperty.link( focused => {
      beforeDiv.tabIndex = focused ? 0 : -1;
      afterDiv.tabIndex = focused ? 0 : -1;
    } );

    const getLinearList = (): Element[] => {
      const display = this.getConnectedDisplays()[ 0 ];

      if ( !display ) {
        return [];
      }

      // gets ALL descendant children for the element
      const children = Array.from( display.pdomRootElement!.getElementsByTagName( '*' ) ).filter( PDOMUtils.isElementFocusable );

      const linearDOM = [];
      for ( let i = 0; i < children.length; i++ ) {

        // searching for the HTML element nodes (NOT Scenery nodes)
        if ( children[ i ].nodeType === Node.ELEMENT_NODE ) {
          linearDOM[ i ] = ( children[ i ] );
        }
      }
      return linearDOM;
    };

    beforeDiv.addEventListener( 'focus', () => {
      const primarySibling = dom.getPDOMInstances()[ 0 ]?.peer?.primarySibling;

      if ( !primarySibling ) {
        beforeDiv.blur();
      }
      else {
        const list = getLinearList();
        const index = list.indexOf( primarySibling );

        if ( index > 0 ) {
          const previousElement = list[ index - 1 ];

          ( previousElement as HTMLElement ).focus();
        }
        else {
          beforeDiv.blur();
        }
      }
    } );

    afterDiv.addEventListener( 'focus', () => {
      const primarySibling = dom.getPDOMInstances()[ 0 ]?.peer?.primarySibling;

      if ( !primarySibling ) {
        console.log( 'no primary sibling, blur' );
        afterDiv.blur();
      }
      else {
        const list = getLinearList();
        const index = list.indexOf( primarySibling );

        if ( index < list.length - 1 ) {
          const nextElement = list[ index + 1 ];

          console.log( nextElement );

          ( nextElement as HTMLElement ).focus();
        }
        else {
          console.log( 'no next element, blur' );
          afterDiv.blur();
        }
      }
    } );
  }

  public focusSearchBox(): void {
    this.input.focus();
  }
}