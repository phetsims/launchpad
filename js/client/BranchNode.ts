// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TinyEmitter, TReadOnlyProperty } from 'scenerystack/axon';
import { FireListener, HBox, HSeparator, Node, Text, VBox } from 'scenerystack/scenery';
import { BranchInfo, RepoListEntry } from '../types/common-types.js';
import moment from 'moment';
import { copyToClipboard } from './copyToClipboard.js';
import { ModeListNode } from './ModeListNode.js';
import { getModes, CustomizationNode } from './getModes.js';
import { ViewContext } from './ViewContext.js';
import { TextPushButton } from 'scenerystack/sun';

const enterEmitter = new TinyEmitter();
document.body.addEventListener( 'keydown', e => {
  // if enter is pressed
  if ( e.keyCode === 13 ) {
    enterEmitter.emit();
  }
} );

export class BranchNode extends VBox {
  public constructor(
    repoListEntry: RepoListEntry,
    branchInfo: BranchInfo,
    searchBoxTextProperty: TReadOnlyProperty<string>,
    launchURL: ( url: string ) => void,
    viewContext: ViewContext
  ) {
    const children = [];

    if ( branchInfo.version && branchInfo.brands ) {
      children.push( new Text( `${branchInfo.version} (${branchInfo.brands.join( ', ' )})`, {
        font: '16px sans-serif'
      } ) );
    }
    if ( branchInfo.isCheckedOut ) {
      children.push( new Text( `Last updated: ${moment( branchInfo.timestamp ).calendar()} (${branchInfo?.sha?.slice( 0, 7 ) ?? ''})`, {
        font: '16px sans-serif',
        cursor: 'pointer',
        inputListeners: [
          new FireListener( {
            fire: async () => {
              await copyToClipboard( branchInfo.sha ?? '' );
            }
          } )
        ]
      } ) );

      if ( branchInfo.dependencyRepos.length ) {
        const latestTimestamp = Math.max( ...Object.values( branchInfo.dependencyTimestampMap ) );

        children.push( new Text( `Dependencies Last Updated: ${moment( latestTimestamp ).calendar()}`, {
          font: '16px sans-serif'
        } ) );
      }

      // TODO: potentially show list of dependencies and the updates https://github.com/phetsims/phettest/issues/20
    }

    const customizationContainerNode = new Node();
    let customizationNode: CustomizationNode | null = null;
    const availableModes = getModes( repoListEntry, branchInfo );

    const selectedModeNameProperty = new Property( availableModes[ 0 ].name );

    selectedModeNameProperty.link( modeName => {
      if ( customizationNode ) {
        customizationNode.dispose();
        customizationNode = null;
      }
      if ( modeName ) {
        const mode = availableModes.find( m => m.name === modeName )!;

        customizationNode = mode.createCustomizationNode();
        customizationContainerNode.children = [ customizationNode ];
      }
    } );

    const launch = () => {
      if ( customizationNode ) {
        launchURL( customizationNode.getURL() );
      }
    };

    const modeListNode = new ModeListNode( availableModes, searchBoxTextProperty, selectedModeNameProperty, viewContext );


    children.push( new HSeparator( {
      stroke: '#888'
    } ) );

    const mainBox = new HBox( {
      align: 'top',
      spacing: 20,
      children: [
        modeListNode,
        new VBox( {
          spacing: 10,
          align: 'left',
          children: [
            new TextPushButton( 'Launch', {
              listener: launch,
              font: '24px sans-serif'
            } ),
            customizationContainerNode
          ]
        } )
      ]
    } );
    children.push( mainBox );

    super( {
      spacing: 20,
      align: 'left',
      children: children
    } );

    enterEmitter.addListener( launch );
    this.disposeEmitter.addListener( () => {
      enterEmitter.removeListener( launch );

      modeListNode.dispose();
    } );
  }
}