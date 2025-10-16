// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TinyEmitter, TReadOnlyProperty } from 'scenerystack/axon';
import { FireListener, HBox, HSeparator, Node, RichText, VBox } from 'scenerystack/scenery';
import { BranchInfo, RepoListEntry } from '../types/common-types.js';
import moment from 'moment';
import { copyToClipboard } from './copyToClipboard.js';
import { ModeListNode } from './ModeListNode.js';
import { CustomizationNode, getModes } from './getModes.js';
import { ViewContext } from './ViewContext.js';
import { AccordionBox } from 'scenerystack/sun';
import { apiBuild, apiBuildEvents, apiUpdate, apiUpdateEvents, getLatestSHA } from './client-api.js';
import { UIText } from './UIText.js';
import { UITextPushButton } from './UITextPushButton.js';
import { buildOutputFont, uiBackgroundColorProperty, uiForegroundColorProperty, uiHeaderFont } from './theme.js';
import { WaitingNode } from './WaitingNode.js';

let isStartup = true;

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
      infoChildren.push( new UIText( `${branchInfo.version} (${branchInfo.brands.join( ', ' )})` ) );
    }

    if ( branchInfo.isCheckedOut ) {
      const selfDependencyNode = new HBox( {
        spacing: 10,
        children: [
          new UIText( `Last Commit: ${moment( branchInfo.timestamp ).calendar()} (${branchInfo?.sha?.slice( 0, 7 ) ?? ''})`, {
            cursor: 'pointer',
            inputListeners: [
              new FireListener( {
                fire: async () => {
                  await copyToClipboard( branchInfo.sha ? `https://github.com/phetsims/${branchInfo.repo}/commit/${branchInfo.sha}` : '' );
                }
              } )
            ]
          } )
        ]
      } );

      const waitingNode = new WaitingNode( viewContext );
      disposeCallbacks.push( () => {
        waitingNode.dispose();
      } );

      selfDependencyNode.addChild( waitingNode );

      ( async () => {
        const latestSHA = await getLatestSHA( branchInfo.repo, branchInfo.branch );

        if ( selfDependencyNode.hasChild( waitingNode ) ) {
          selfDependencyNode.removeChild( waitingNode );
        }

        if ( branchInfo.sha ) {
          if ( latestSHA === branchInfo.sha ) {
            selfDependencyNode.addChild( new UIText( ' (Up to date)', { fill: 'green' } ) );
          }
          else {
            selfDependencyNode.addChild( new UIText( ' (Out of date)', { fill: 'red' } ) );
          }
        }
      } )().catch( e => { throw e; } );


      infoChildren.push( selfDependencyNode );
    }

    if ( branchInfo.isCheckedOut && branchInfo.branch === 'main' ) {


      if ( branchInfo.dependencyRepos.length ) {
        const latestTimestamp = Math.max( ...Object.values( branchInfo.dependencyTimestampMap ) );

        infoChildren.push( new UIText( `Dependencies Last Updated: ${moment( latestTimestamp ).calendar()}` ) );
      }

      // TODO: potentially show list of dependencies and the updates https://github.com/phetsims/phettest/issues/20
    }

    const customizationContainerNode = new Node();
    let customizationNode: CustomizationNode | null = null;
    const availableModes = getModes( repoListEntry, branchInfo );

    // Some logic to select the same mode on startup (load)
    const lastModeName = localStorage.getItem( 'lastModeName' ) ?? null;
    const initialModeName = isStartup && lastModeName && availableModes.some( mode => mode.name === lastModeName ) ? lastModeName : availableModes[ 0 ].name;
    isStartup = false;

    const selectedModeNameProperty = new Property( initialModeName );
    selectedModeNameProperty.link( modeName => {
      localStorage.setItem( 'lastModeName', modeName );
    } );

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

        const waitingNode = new WaitingNode( viewContext );
        disposeCallbacks.push( () => {
          waitingNode.dispose();
        } );

        updateContainer.children = [
          new UIText( 'Updating checkout...' ),
          waitingNode
        ];
      };

      const updateStatusNode = new HBox( {
        spacing: 10,
        children: [
          new UIText( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? `Checkout updated: ${moment( branchInfo.lastUpdatedTime ).calendar()}` : 'Not checked out' ),
          new UITextPushButton( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? 'Update Checkout' : 'Check Out', {
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
      const buildStatusText = new UIText( branchInfo.lastBuiltTime === null ? 'No build available' : `Last successful build: ${moment( branchInfo.lastBuiltTime ).calendar()}` );

      const buildOutputContainer = new Node();

      const getBuildOnOutput = (): ( ( str: string ) => void ) => {
        let outputString = '';

        const textNode = new RichText( 'Starting build...', {
          font: buildOutputFont,
          fill: uiForegroundColorProperty,
          replaceNewlines: true
        } );

        const waitingNode = new WaitingNode( viewContext );
        disposeCallbacks.push( () => {
          waitingNode.dispose();
        } );

        buildOutputContainer.children = [
          new AccordionBox( textNode, {
            titleNode: new HBox( {
              spacing: 5,
              children: [
                new UIText( 'Build Running...' ),
                waitingNode
              ],
              justify: 'left'
            } ),
            expandedDefaultValue: false,
            titleAlignX: 'left',
            showTitleWhenExpanded: true,
            useExpandedBoundsWhenCollapsed: false,
            useContentWidthWhenCollapsed: false,
            titleBarExpandCollapse: true,
            stroke: null,
            fill: uiBackgroundColorProperty,
            buttonXMargin: 0
          } )
        ];

        const onOutput = ( str: string ) => {
          outputString += str;
          textNode.string = outputString;
        };

        return onOutput;
      };

      const buildButton = new UITextPushButton( branchInfo.lastBuiltTime ? 'Rebuild' : 'Build', {
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
            new UITextPushButton( 'Launch', {
              listener: launch,
              font: uiHeaderFont
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