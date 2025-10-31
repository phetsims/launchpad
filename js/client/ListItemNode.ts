// Copyright 2025, University of Colorado Boulder

/**
 * Repo list item for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { DerivedProperty, TProperty } from 'scenerystack/axon';
import { Color, FireListener, Node, Rectangle, Voicing } from 'scenerystack/scenery';
import { ViewContext } from './ViewContext.js';
import { TooltipListener } from './TooltipListener.js';
import { autocompleteMatchColorProperty, listEvenColorProperty, listHoverColorProperty, listOddColorProperty, listSelectedColorProperty } from './theme.js';
import { UIRichText } from './UIRichText.js';
import { launchTriggerEmitter } from './launchTriggerEmitter.js';

// TODO: GC https://github.com/phetsims/phettest/issues/20
export class ListItemNode extends Node {
  public constructor(
    item: string,
    selectedItemProperty: TProperty<string | null>,
    viewContext: ViewContext,
    highlight: ( before: string, after: string ) => string,
    index: number,
    width: number,
    className: string,
    description?: string
  ) {
    const fireListener = new FireListener( {
      fire: () => {
        if ( selectedItemProperty.value === item ) {
          // Fire on double-click
          launchTriggerEmitter.emit();
        }
        else {
          selectedItemProperty.value = item;
        }
      }
    } );

    const vPadding = 2.5;

    // TODO: arrow keys to switch between entries (up/down) https://github.com/phetsims/phettest/issues/20

    const richText = new UIRichText( '' );

    const highlightListener = ( color: Color ) => {
      const cssColor = color.toCSS();
      richText.string = highlight( `<b style="color: ${cssColor};">`, '</b>' );
    };
    autocompleteMatchColorProperty.link( highlightListener );

    const backgroundRect = new Rectangle( 0, richText.top - vPadding, width, richText.height + 2 * vPadding );

    const fillProperty = new DerivedProperty( [
      selectedItemProperty,
      fireListener.isHighlightedProperty,
      listSelectedColorProperty,
      listHoverColorProperty,
      listEvenColorProperty,
      listOddColorProperty
    ], ( selectedItem, isHighlighted, selectedColor, listHoverColor, listEvenColor, listOddColor ) => {
      const isSelected = selectedItem === item;
      const isEven = index % 2 === 0;

      if ( isSelected ) {
        return selectedColor;
      }
      else {
        return isHighlighted
          ? listHoverColor
          : isEven
            ? listEvenColor
            : listOddColor;
      }
    } );

    backgroundRect.fill = fillProperty;

    super( {
      cursor: 'pointer',
      children: [
        backgroundRect,
        richText
      ],
      inputListeners: [
        fireListener
      ],
      accessibleName: item,
      labelContent: description ?? null,

      tagName: 'input',
      inputType: 'radio',
      labelTagName: 'label',

      containerTagName: 'div',

      appendLabel: true,
      appendDescription: true
    } );

    this.setPDOMAttribute( 'name', className );

    selectedItemProperty.link( selectedItem => {
      this.pdomChecked = item === selectedItem;
    } );

    this.addDisposable( fillProperty );
    this.addDisposable( fireListener );
    this.disposeEmitter.addListener( () => {
      autocompleteMatchColorProperty.unlink( highlightListener );
    } );

    if ( description ) {
      const tooltipListener = new TooltipListener( viewContext );
      this.addInputListener( tooltipListener );
      this.disposeEmitter.addListener( () => tooltipListener.dispose() );
    }
  }
}