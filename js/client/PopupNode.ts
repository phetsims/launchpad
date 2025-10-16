// Copyright 2025, University of Colorado Boulder

/**
 * Minimal popup node
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */


import { ViewContext } from './ViewContext.js';

import { optionize } from 'scenerystack/phet-core';
import { AlignBox, Node, Rectangle } from 'scenerystack/scenery';
import { Panel, PanelOptions } from 'scenerystack/sun';
import { barrierColorProperty, uiBackgroundColorProperty, uiForegroundColorProperty } from './theme.js';

export type PopupNodeOptions = {
  allowBarrierClickToHide?: boolean;
  panelOptions?: PanelOptions;
};

export class PopupNode extends Node {
  public constructor(
    public readonly content: Node,
    public readonly viewContext: ViewContext,
    providedOptions?: PopupNodeOptions,
  ) {
    const options = optionize<PopupNodeOptions>()(
      {
        allowBarrierClickToHide: true,
        panelOptions: {
          xMargin: 15,
          yMargin: 15,
          fill: uiBackgroundColorProperty,
          stroke: uiForegroundColorProperty
        }
      },
      providedOptions
    );

    super();

    const barrier = new Rectangle( { fill: barrierColorProperty } );
    this.addChild( barrier );
    viewContext.layoutBoundsProperty.link( layoutBounds => {
      barrier.rectBounds = layoutBounds;
    } );

    if ( options.allowBarrierClickToHide ) {
      barrier.addInputListener( {
        down: () => {
          this.hide();
        }
      } );
    }

    const panel = new Panel( content, options.panelOptions );

    viewContext.layoutBoundsProperty.link( layoutBounds => {
      panel.maxWidth = layoutBounds.width * 0.9;
      panel.maxHeight = layoutBounds.height * 0.9;
    } );

    this.addChild(
      new AlignBox( panel, {
        alignBoundsProperty: viewContext.layoutBoundsProperty,
        yAlign: 'top',
        topMargin: 50
      } )
    );
  }

  public show(): void {
    if ( !this.viewContext.glassPane.hasChild( this ) ) {
      this.reset();
      this.viewContext.glassPane.addChild( this );
    }
  }

  public hide(): void {
    if ( this.viewContext.glassPane.hasChild( this ) ) {
      this.viewContext.glassPane.removeChild( this );
    }
  }

  public reset(): void {
    // nothing
  }
}
