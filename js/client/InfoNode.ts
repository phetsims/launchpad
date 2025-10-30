// Copyright 2025, University of Colorado Boulder

/**
 * Info node
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { PopupNode } from './PopupNode.js';
import { UIText } from './UIText.js';
import { ViewContext } from './ViewContext.js';
import { VBox } from 'scenerystack/scenery';
import { uiHeaderFont } from './theme.js';

export class InfoNode extends PopupNode {
  public constructor( viewContext: ViewContext ) {
    super(
      new VBox( {
        spacing: 20,
        align: 'left',
        stretch: true,
        children: [
          new UIText( 'Documentation', {
            font: uiHeaderFont
          } )

          // TODO:
        ]
      } ),
      viewContext
    );
  }
}
