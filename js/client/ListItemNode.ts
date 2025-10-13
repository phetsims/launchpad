// Copyright 2025, University of Colorado Boulder

/**
 * Repo list item for phettest
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DerivedProperty, TProperty } from 'scenerystack/axon';
import { FireListener, Node, Rectangle, RichText } from 'scenerystack/scenery';
import { ViewContext } from './ViewContext.js';
import { TooltipListener } from './TooltipListener.js';

// TODO: GC https://github.com/phetsims/phettest/issues/20
export class ListItemNode extends Node {
  public constructor(
    item: string,
    selectedItemProperty: TProperty<string | null>,
    viewContext: ViewContext,
    highlight: ( before: string, after: string ) => string,
    index: number,
    width: number,
    description?: string
  ) {
    const fireListener = new FireListener( {
      fire: () => {
        selectedItemProperty.value = item;
      }
    } );

    const vPadding = 2.5;

    // TODO: arrow keys to switch between entries (up/down) https://github.com/phetsims/phettest/issues/20

    const richText = new RichText( highlight( '<b style="color: #02a;">', '</b>' ), {
      font: '16px sans-serif'
    } );
    const backgroundRect = new Rectangle( 0, richText.top - vPadding, width, richText.height + 2 * vPadding );

    backgroundRect.fill = new DerivedProperty( [
      selectedItemProperty,
      fireListener.isHighlightedProperty
    ], ( selectedItem, isHighlighted ) => {
      const isSelected = selectedItem === item;
      const isEven = index % 2 === 0;

      const unincludedHoverColor = '#ccc';
      const unincludedEvenColor = '#ddd';
      const unincludedOddColor = '#eee';

      if ( isSelected ) {
        return '#9cf';
      }
      else {
        return isHighlighted
          ? unincludedHoverColor
          : isEven
            ? unincludedEvenColor
            : unincludedOddColor;
      }
    } );

    super( {
      cursor: 'pointer',
      children: [
        backgroundRect,
        richText
      ],
      inputListeners: [
        fireListener
      ],
      tagName: 'div',
      accessibleName: item,
      labelContent: description ?? null
    } );

    this.addDisposable( fireListener );

    if ( description ) {
      const tooltipListener = new TooltipListener( viewContext );
      this.addInputListener( tooltipListener );
      this.disposeEmitter.addListener( () => tooltipListener.dispose() );
    }
  }
}