// Copyright 2025, University of Colorado Boulder

/**
 * Themed waiting/spinning indicator
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Node } from 'scenerystack/scenery';
import { SpinningIndicatorNode } from 'scenerystack/scenery-phet';
import { ViewContext } from './ViewContext.js';
import { isDarkModeProperty } from './theme.js';

export class WaitingNode extends Node {
  public constructor( viewContext: ViewContext ) {
    super( {} );

    const lightNode = new SpinningIndicatorNode();
    const darkNode = new SpinningIndicatorNode( {
      activeColor: 'rgba( 255, 255, 255, 1 )',
      inactiveColor: 'rgba( 255, 255, 255, 0.15 )'
    } );

    const swapListener = ( isDarkMode: boolean ) => {
      this.children = isDarkMode ? [ darkNode ] : [ lightNode ];
    };

    isDarkModeProperty.link( swapListener );

    const stepListener = ( dt: number ) => {
      ( isDarkModeProperty.value ? darkNode : lightNode ).step( dt );
    };
    viewContext.stepEmitter.addListener( stepListener );

    this.disposeEmitter.addListener( () => {
      isDarkModeProperty.unlink( swapListener );

      viewContext.stepEmitter.removeListener( stepListener );
    } );
  }
}