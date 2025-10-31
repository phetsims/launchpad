// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BooleanProperty } from 'scenerystack/axon';
import { DOM, DOMOptions, PDOMUtils } from 'scenerystack/scenery';
import { EmptySelfOptions, optionize, WithRequired } from 'scenerystack/phet-core';

export type FocusableDOMOptions = WithRequired<DOMOptions, 'tagName'>;

export class FocusableDOMNode extends DOM {

  public readonly isElementFocusedProperty = new BooleanProperty( false );

  public constructor( public readonly focusableElement: HTMLElement, providedOptions: FocusableDOMOptions ) {

    const options = optionize<FocusableDOMOptions, EmptySelfOptions, DOMOptions>()( {
      // Default to allowing input(!)
      allowInput: true
    }, providedOptions );

    const div = document.createElement( 'div' );

    const beforeDiv = document.createElement( 'div' );
    const afterDiv = document.createElement( 'div' );

    div.appendChild( beforeDiv );
    div.appendChild( focusableElement );
    div.appendChild( afterDiv );

    super( div, options );

    this.addInputListener( {
      focus: () => {
        focusableElement.tabIndex = 0;
        focusableElement.focus();
      }
    } );

    focusableElement.addEventListener( 'focus', () => {
      this.isElementFocusedProperty.value = true;
    } );

    focusableElement.addEventListener( 'blur', () => {
      this.isElementFocusedProperty.value = false;
    } );

    this.isElementFocusedProperty.link( focused => {
      beforeDiv.tabIndex = focused ? 0 : -1;
      focusableElement.tabIndex = focused ? 0 : -1; // We'll prevent it from manually receiving focus the normal way
      afterDiv.tabIndex = focused ? 0 : -1;
    } );

    const getLinearList = (): Element[] => {
      const display = this.getConnectedDisplays()[ 0 ];

      if ( !display ) {
        return [];
      }

      // gets ALL descendant children for the element
      const initialChildren = Array.from( display.pdomRootElement!.getElementsByTagName( '*' ) ).filter( PDOMUtils.isElementFocusable );

      // Filter out unchecked radio buttons
      const children = initialChildren.filter( element => {
        // If we are a radio button
        if ( element.tagName === 'INPUT' && ( element as HTMLInputElement ).type === 'radio' ) {
          const name = ( element as HTMLInputElement ).name;

          // And have a name and are NOT checked
          if ( name && !( element as HTMLInputElement ).checked ) {

            // Only allow us to be in the order if there is not a checked radio button with the same name
            return !initialChildren.some( otherElement => {
              return otherElement.tagName === 'INPUT' && ( otherElement as HTMLInputElement ).type === 'radio' &&
                     ( otherElement as HTMLInputElement ).name === name &&
                     ( otherElement as HTMLInputElement ).checked;
            } );
          }
        }

        return true;
      } );

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
      const primarySibling = this.getPDOMInstances()[ 0 ]?.peer?.primarySibling;

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
      const primarySibling = this.getPDOMInstances()[ 0 ]?.peer?.primarySibling;

      if ( !primarySibling ) {
        afterDiv.blur();
      }
      else {
        const list = getLinearList();
        const index = list.indexOf( primarySibling );

        if ( index < list.length - 1 ) {
          const nextElement = list[ index + 1 ];

          ( nextElement as HTMLElement ).focus();
        }
        else {
          afterDiv.blur();
        }
      }
    } );
  }
}