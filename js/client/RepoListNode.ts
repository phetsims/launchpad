// Copyright 2025, University of Colorado Boulder

/**
 * Repo list for phettest
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Multilink, TProperty, TReadOnlyProperty } from 'scenerystack/axon';
import { VBox } from 'scenerystack/scenery';
import { RepoList, RepoListEntry } from '../types/common-types.js';
import { ListItemNode } from './ListItemNode.js';
import fuzzysort from 'fuzzysort';
import { ViewContext } from './ViewContext.js';

const WIDTH = 300;

export class RepoListNode extends VBox {
  public constructor(
    repoListProperty: TReadOnlyProperty<RepoList | null>,
    searchBoxTextProperty: TReadOnlyProperty<string>,
    selectedRepoProperty: TProperty<string | null>,
    viewContext: ViewContext
  ) {
    super( {
      align: 'left',
      // TODO: specify these in better places https://github.com/phetsims/phettest/issues/20
      layoutOptions: {
        minContentWidth: WIDTH
      }
    } );

    const multilink = Multilink.multilink( [ repoListProperty, searchBoxTextProperty ], ( repoList, searchText ) => {
      if ( !repoList ) {
        return;
      }

      // TODO: GC-friendly https://github.com/phetsims/phettest/issues/20

      // Filter out words starting with digits, e.g. 1-9 (they are likely numeric branch names, we want to read those out)
      searchText = searchText.split( ' ' ).filter( s => !/^\d/.test( s ) ).join( ' ' );

      // Filter out words starting with ':' (a colon), since we will use this for other search functionality
      searchText = searchText.split( ' ' ).filter( s => !s.startsWith( ':' ) ).join( ' ' );

      const searchResults = searchText.length ? fuzzysort.go<RepoListEntry>( searchText, repoList, { key: 'name' } ) : repoList ? repoList.map( repoEntry => {
        return {
          obj: repoEntry,
          score: 0,
          indexes: [],
          highlight: () => repoEntry.name
        };
      } ) : [];

      if ( searchResults.length === 0 ) {
        selectedRepoProperty.value = null;
      }
      else {
        if (
          selectedRepoProperty.value === null ||
          !searchResults.some( result => result.obj.name === selectedRepoProperty.value )
        ) {
          selectedRepoProperty.value = searchResults[ 0 ].obj.name;
        }
      }

      const oldChildren = this.children.slice();
      this.children = searchResults.map( ( result, i ) => {
        return new ListItemNode( result.obj.name, selectedRepoProperty, viewContext, result.highlight ? result.highlight.bind( result ) : () => result.obj.name, i, WIDTH );
      } );
      oldChildren.forEach( child => child.dispose() );
    } );

    this.disposeEmitter.addListener( () => multilink.dispose() );
  }
}