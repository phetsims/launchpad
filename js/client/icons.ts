// Copyright 2025, University of Colorado Boulder

/**
 * Assorted icons
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Path, Rectangle } from 'scenerystack/scenery';
import { checkSolidShape, syncShape } from 'scenerystack/sun';
import { ViewContext } from './ViewContext.js';
import { TooltipListener } from './TooltipListener.js';

export class UpToDateIcon extends Rectangle {
  public constructor( viewContext: ViewContext ) {
    super( 0, 0, 16, 16, 4, 4, {
      fill: '#5c3',
      children: [
        new Path( checkSolidShape, {
          fill: '#fff',
          scale: 0.384,
          centerX: 8,
          centerY: 8
        } )
      ],
      labelContent: 'Up to date',
      inputListeners: [
        new TooltipListener( viewContext )
      ]
    } );
  }
}

export class OutOfDateIcon extends Rectangle {
  public constructor( viewContext: ViewContext ) {
    super( 0, 0, 16, 16, 4, 4, {
      fill: '#ff3333',
      children: [
        new Path( syncShape, {
          fill: '#fff',
          scale: 0.384,
          centerX: 8,
          centerY: 8
        } )
      ],
      labelContent: 'Out of date',
      inputListeners: [
        new TooltipListener( viewContext )
      ]
    } );
  }
}