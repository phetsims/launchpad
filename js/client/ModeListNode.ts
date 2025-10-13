// Copyright 2025, University of Colorado Boulder

/**
 * Repo list for phettest
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { TProperty, TReadOnlyProperty } from 'scenerystack/axon';
import { VBox } from 'scenerystack/scenery';
import { ListItemNode } from './ListItemNode.js';
import fuzzysort from 'fuzzysort';
import { ModeData } from './getModes.js';
import { ViewContext } from './ViewContext.js';

const WIDTH = 200;

export class ModeListNode extends VBox {
  public constructor(
    modes: ModeData[],
    searchBoxTextProperty: TReadOnlyProperty<string>,
    selectedModeNameProperty: TProperty<string>,
    viewContext: ViewContext
  ) {
    super( {
      align: 'left',
      // TODO: specify these in better places https://github.com/phetsims/phettest/issues/20
      layoutOptions: {
        minContentWidth: WIDTH
      }
    } );

    const searchTextListener = ( searchText: string ) => {
      // TODO: GC-friendly https://github.com/phetsims/phettest/issues/20

      // Filter out words NOT starting with ':' (a colon), and remove the colons
      searchText = searchText.split( ' ' ).filter( s => s.startsWith( ':' ) ).map( s => s.slice( 1 ) ).join( ' ' );

      const searchResults = searchText.length ? fuzzysort.go( searchText, modes, { key: 'name' } ) : modes.map( mode => {
        return {
          obj: mode,
          score: 0,
          indexes: [],
          highlight: () => mode.name
        };
      } );

      if (
        searchResults.length > 0 &&
        selectedModeNameProperty.value === null ||
        !searchResults.some( result => result.obj.name === selectedModeNameProperty.value )
      ) {
        selectedModeNameProperty.value = searchResults[ 0 ].obj.name;
      }

      const oldChildren = this.children.slice();
      this.children = searchResults.map( ( result, i ) => {
        return new ListItemNode( result.obj.name, selectedModeNameProperty, viewContext, result.highlight ? result.highlight.bind( result ) : () => result.obj.name, i, WIDTH, result.obj.description );
      } );
      oldChildren.forEach( child => child.dispose() );
    };

    searchBoxTextProperty.link( searchTextListener );
    this.disposeEmitter.addListener( () => searchBoxTextProperty.unlink( searchTextListener ) );
  }
}