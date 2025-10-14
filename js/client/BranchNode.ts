// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TinyEmitter, TReadOnlyProperty } from 'scenerystack/axon';
import { FireListener, HBox, HSeparator, Node, RichText, Text, VBox } from 'scenerystack/scenery';
import { BranchInfo, RepoListEntry } from '../types/common-types.js';
import moment from 'moment';
import { copyToClipboard } from './copyToClipboard.js';
import { ModeListNode } from './ModeListNode.js';
import { getModes, CustomizationNode } from './getModes.js';
import { ViewContext } from './ViewContext.js';
import { AccordionBox, TextPushButton } from 'scenerystack/sun';
import { apiBuild, apiBuildEvents, apiUpdate, apiUpdateEvents } from './client-api.js';
import { SpinningIndicatorNode } from 'scenerystack/scenery-phet';

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
    requestNewBranchInfo: () => void,
    viewContext: ViewContext
  ) {
    const infoChildren = [];
    const disposeCallbacks: ( () => void )[] = [];

    if ( branchInfo.version && branchInfo.brands ) {
      infoChildren.push( new Text( `${branchInfo.version} (${branchInfo.brands.join( ', ' )})`, {
        font: '16px sans-serif'
      } ) );
    }
    if ( branchInfo.isCheckedOut && branchInfo.branch === 'main' ) {
      infoChildren.push( new Text( `Last updated: ${moment( branchInfo.timestamp ).calendar()} (${branchInfo?.sha?.slice( 0, 7 ) ?? ''})`, {
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

        infoChildren.push( new Text( `Dependencies Last Updated: ${moment( latestTimestamp ).calendar()}`, {
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

    if ( branchInfo.branch !== 'main' ) {
      const updateContainer = new HBox();

      const showUpdating = () => {
        updateStatusNode.visible = false;

        const indicatorNode = new SpinningIndicatorNode();
        const stepListener = ( dt: number ) => {
          indicatorNode.step( dt );
        };
        viewContext.stepEmitter.addListener( stepListener );
        disposeCallbacks.push( () => {
          viewContext.stepEmitter.removeListener( stepListener );
        } );

        updateContainer.children = [
          new Text( 'Updating checkout...', { font: '16px sans-serif' } ),
          indicatorNode
        ];
      };

      const updateStatusNode = new HBox( {
        spacing: 10,
        children: [
          new Text( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? `Checkout updated: ${moment( branchInfo.lastUpdatedTime ).calendar()}` : 'Not checked out', { font: '16px sans-serif' } ),
          new TextPushButton( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? 'Update Checkout' : 'Check Out', {
            font: '16px sans-serif',
            listener: async () => {
              showUpdating();

              await apiUpdate( branchInfo.repo, branchInfo.branch );
              requestNewBranchInfo();
            }
          } )
        ]
      } );

      infoChildren.push( updateContainer );
      infoChildren.push( updateStatusNode );

      if ( branchInfo.updateCheckoutJobID !== null ) {
        showUpdating();

        ( async () => {
          await apiUpdateEvents( branchInfo.updateCheckoutJobID! );
          requestNewBranchInfo();
        } )().catch( e => { throw e; } );
      }

      // TODO: show update status for release branches!!!! --- get them updated and built ideally --- allow rebuilds because of babel
    }

    // Build status and button
    if ( repoListEntry.isRunnable && branchInfo.isCheckedOut ) {
      const buildStatusText = new Text( branchInfo.lastBuiltTime === null ? 'No build available' : `Last successful build: ${moment( branchInfo.lastBuiltTime ).calendar()}`, {
        font: '16px sans-serif'
      } );

      const buildOutputContainer = new Node();

      const getBuildOnOutput = (): ( () => void ) => {
        let outputString = '';

        const textNode = new RichText( 'Building...', {
          font: '12px sans-serif',
          replaceNewlines: true
        } );
        buildOutputContainer.children = [
          new AccordionBox( textNode, {
            titleNode: new Text( 'Build Running: Output', { font: '16px sans-serif' } )
          } )
        ];

        const onOutput = ( str: string ) => {
          outputString += str;
          textNode.string = outputString;
        };

        return onOutput;
      };

      const buildButton = new TextPushButton( branchInfo.lastBuiltTime ? 'Rebuild' : 'Build', {
        font: '16px sans-serif',
        listener: async () => {
          buildButton.visible = false;
          buildStatusText.visible = false;

          const success = await apiBuild( branchInfo.repo, branchInfo.branch, getBuildOnOutput() );

          if ( success ) {
            requestNewBranchInfo();
          }
        }
      } );

      if ( branchInfo.buildJobID !== null ) {
        ( async () => {
          buildButton.visible = false;
          buildStatusText.visible = false;

          const success = await apiBuildEvents( branchInfo.buildJobID, getBuildOnOutput() );

          if ( success ) {
            requestNewBranchInfo();
          }
        } )().catch( e => { throw e; } );
      }

      infoChildren.push( new VBox( {
        spacing: 10,
        children: [
          new HBox( {
            spacing: 10,
            children: [
              buildStatusText,
              buildButton
            ]
          } ),
          buildOutputContainer
        ]
      } ) );
    }

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

    super( {
      spacing: 20,
      align: 'left',
      children: [
        new VBox( {
          align: 'left',
          spacing: 5,
          children: infoChildren
        } ),
        new HSeparator( {
          stroke: '#888'
        } ),
        mainBox
      ]
    } );

    disposeCallbacks.forEach( callback => this.disposeEmitter.addListener( callback ) );

    enterEmitter.addListener( launch );
    this.disposeEmitter.addListener( () => {
      enterEmitter.removeListener( launch );

      modeListNode.dispose();
    } );
  }
}