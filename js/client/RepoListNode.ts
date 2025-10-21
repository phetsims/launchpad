// Copyright 2025, University of Colorado Boulder

/**
 * Repo list for launchpad
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Multilink, TProperty, TReadOnlyProperty } from 'scenerystack/axon';
import { VBox } from 'scenerystack/scenery';
import { Repo, RepoList, RepoListEntry } from '../types/common-types.js';
import { ListItemNode } from './ListItemNode.js';
import fuzzysort from 'fuzzysort';
import { ViewContext } from './ViewContext.js';
import { repoFilterTypeProperty } from './settings.js';
import { RepoFilterType } from './RepoFilterType.js';

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

    let filteredRepos: Repo[] = [];

    const multilink = Multilink.multilink(
      [ repoListProperty,
        searchBoxTextProperty,
        repoFilterTypeProperty
      ], ( repoList, searchText, repoFilterType ) => {
      if ( !repoList ) {
        return;
      }

      repoList = repoList.filter( repoListEntry => {
        if ( repoFilterType === RepoFilterType.ALL ) {
          return true;
        }
        else if ( repoFilterType === RepoFilterType.RUNNABLES ) {
          return repoListEntry.isRunnable;
        }
        else if ( repoFilterType === RepoFilterType.SIMULATIONS ) {
          return repoListEntry.isSim;
        }
        else {
          throw new Error( 'unknown repo filter type: ' + repoFilterType );
        }
      } );

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

      filteredRepos = searchResults.map( result => result.obj.name );

      if ( searchResults.length === 0 ) {
        selectedRepoProperty.value = null;
      }
      else if ( selectedRepoProperty.value === null && searchText.length === 0 ) {
        const lastSelectedRepo = localStorage.getItem( 'lastSelectedRepo' ) ?? null;

        if ( lastSelectedRepo && searchResults.some( result => result.obj.name === lastSelectedRepo ) ) {
          selectedRepoProperty.value = lastSelectedRepo;
        }
        else {
          selectedRepoProperty.value = searchResults[ 0 ].obj.name;
        }
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

    // up/down arrow key handling TODO: could we potentially FOCUS the list, and have them be traversed as a group? https://github.com/phetsims/phettest/issues/20
    document.body.addEventListener( 'keydown', e => {
      if ( e.keyCode === 38 || e.keyCode === 40 ) {
        const selectedRepo = selectedRepoProperty.value;
        if ( !filteredRepos || filteredRepos.length === 0 || !selectedRepo ) {
          return;
        }

        const currentIndex = filteredRepos.findIndex( repo => repo === selectedRepo );
        if ( currentIndex < 0 ) {
          return;
        }

        // TODO: these preventDefaults might be annoying to a11y? https://github.com/phetsims/phettest/issues/20
        // if 'up' is pressed
        if ( e.keyCode === 38 ) {
          const newIndex = ( currentIndex - 1 + filteredRepos.length ) % filteredRepos.length;
          selectedRepoProperty.value = filteredRepos[ newIndex ];
          e.preventDefault();
        }
        // if 'down' is pressed
        if ( e.keyCode === 40 ) {
          const newIndex = ( currentIndex + 1 ) % filteredRepos.length;
          selectedRepoProperty.value = filteredRepos[ newIndex ];
          e.preventDefault();
        }
      }
    } );

    this.disposeEmitter.addListener( () => multilink.dispose() );
  }
}