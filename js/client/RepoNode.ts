// Copyright 2025, University of Colorado Boulder

/**
 * Contains all of the UI for a single repository
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TReadOnlyProperty } from 'scenerystack/axon';
import { HBox, Node, Text, VBox } from 'scenerystack/scenery';
import { ComboBox } from 'scenerystack/sun';
import { BranchInfo, RepoListEntry } from '../types/common-types.js';
import { apiGetBranchInfo } from './client-api.js';
import { BranchNode } from './BranchNode.js';
import { ViewContext } from './ViewContext.js';

export class RepoNode extends VBox {
  public constructor(
    repoListEntry: RepoListEntry,
    searchBoxTextProperty: TReadOnlyProperty<string>,
    launchURL: ( url: string ) => void,
    viewContext: ViewContext
  ) {
    const branchProperty = new Property( 'main' );

    const branchInfoProperty = new Property<BranchInfo | null>( null );

    branchProperty.link( async branch => {
      branchInfoProperty.value = null;

      const branchInfo = await apiGetBranchInfo( repoListEntry.name, branch );

      // Ensure we didn't get preempted by something
      if ( branchInfoProperty.value === null && branchProperty.value === branch ) {
        branchInfoProperty.value = branchInfo;
      }
    } );

    const requestNewBranchInfo = async () => {
      const branch = branchProperty.value;

      const branchInfo = await apiGetBranchInfo( repoListEntry.name, branch );

      // Ensure we haven't navigated to a new branch
      if ( branchProperty.value === branch ) {
        branchInfoProperty.value = branchInfo;
      }
    };

    const contentContainer = new Node();

    super( {
      spacing: 5,
      align: 'left',
      children: [
        new HBox( {
          spacing: 20,
          children: [
            new Text( repoListEntry.name, {
              font: 'bold 30px sans-serif'
            } ),
            new ComboBox( branchProperty, repoListEntry.branches.slice().sort( ( a, b ) => {
              if ( a === 'main' ) {
                return -1;
              }
              if ( b === 'main' ) {
                return 1;
              }
              return a.localeCompare( b );
            } ).map( branch => {
              return {
                value: branch,
                accessibleName: branch,
                createNode: () => new Text( branch, { font: '16px sans-serif' } )
              };
            } ), viewContext.glassPane, {
              xMargin: 10,
              yMargin: 3
            } )
          ]
        } ),
        contentContainer
      ]
    } );

    const searchListener = ( searchText: string ) => {
      const possibleBranch = searchText.split( ' ' ).find( s => /^\d/.test( s ) );

      if ( possibleBranch && repoListEntry.branches.includes( possibleBranch ) ) {
        branchProperty.value = possibleBranch;
      }
    };
    searchBoxTextProperty.link( searchListener );
    this.disposeEmitter.addListener( () => {
      searchBoxTextProperty.unlink( searchListener );
    } );

    const branchInfoListener = ( branchInfo: BranchInfo | null ) => {
      const oldChildren = contentContainer.children.slice();
      contentContainer.children = [ branchInfo ? new BranchNode( repoListEntry, branchInfo, searchBoxTextProperty, launchURL, requestNewBranchInfo, viewContext ) : new Text( 'Loading...', { font: '16px sans-serif', opacity: 0.5 } ) ];
      oldChildren.forEach( child => child.dispose() );
    };

    branchInfoProperty.link( branchInfoListener );

    this.disposeEmitter.addListener( () => {
      branchInfoProperty.unlink( branchInfoListener );
      contentContainer.children.forEach( child => child.dispose() );
    } );
  }
}