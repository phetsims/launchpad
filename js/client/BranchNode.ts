// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Property, TinyEmitter, TReadOnlyProperty } from 'scenerystack/axon';
import { FireListener, GridBox, HBox, HSeparator, Node, RichText, VBox } from 'scenerystack/scenery';
import { BranchInfo, Repo, RepoListEntry, SHA } from '../types/common-types.js';
import moment from 'moment';
import { copyToClipboard } from './copyToClipboard.js';
import { ModeListNode } from './ModeListNode.js';
import { CustomizationNode, getModes } from './getModes.js';
import { ViewContext } from './ViewContext.js';
import { apiBuild, apiBuildEvents, apiUpdate, apiUpdateEvents, getLatestSHA, getLatestSHAs } from './client-api.js';
import { UIText } from './UIText.js';
import { UITextPushButton } from './UITextPushButton.js';
import { buildOutputFont, uiForegroundColorProperty, uiHeaderFont } from './theme.js';
import { WaitingNode } from './WaitingNode.js';
import { UIAccordionBox } from './UIAccordionBox.js';
import { OutOfDateIcon, UpToDateIcon } from './icons.js';

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

    // Our promises (at the start) that we can listen to in multiple places
    const latestSHAPromise: Promise<SHA | null> = branchInfo.isCheckedOut ? getLatestSHA( branchInfo.repo, branchInfo.branch ) : Promise.resolve( null );
    const latestSHAsPromise: Promise<Record<Repo, SHA>> = ( branchInfo.isCheckedOut && branchInfo.branch === 'main' && branchInfo.dependencyRepos.length )
      ? getLatestSHAs( branchInfo.dependencyRepos )
      : latestSHAPromise.then( sha => {
        // If we are a non-main branch, just include the main SHA.
        return { [ branchInfo.repo ]: sha! };
      } );
    const areDependenciesUpToDatePromise: Promise<boolean> = latestSHAsPromise.then( shaMap => {
      let allUpToDate = true;

      if ( branchInfo.branch !== 'main' ) {
        const localSHA = branchInfo.sha;
        const latestSHA = shaMap[ branchInfo.repo ];

        if ( localSHA !== latestSHA ) {
          allUpToDate = false;
        }
      }
      else {
        for ( const dependencyRepo of branchInfo.dependencyRepos ) {
          const localSHA = branchInfo.dependencySHAMap[ dependencyRepo ];
          const latestSHA = shaMap[ dependencyRepo ];

          if ( localSHA !== latestSHA ) {
            allUpToDate = false;
          }
        }
      }

      return allUpToDate;
    } );

    if ( branchInfo.version && branchInfo.brands && repoListEntry.isRunnable ) {
      infoChildren.push( new UIText( `${branchInfo.version} (${branchInfo.brands.join( ', ' )})` ) );
    }

    if ( branchInfo.isCheckedOut ) {
      const selfDependencyNode = new HBox( {
        spacing: 10,
        children: [
          new UIText( `Last Updated Commit: ${moment( branchInfo.timestamp ).calendar()} (${branchInfo?.sha?.slice( 0, 7 ) ?? ''})`, {
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
        const latestSHA = await latestSHAPromise;

        if ( selfDependencyNode.hasChild( waitingNode ) ) {
          selfDependencyNode.removeChild( waitingNode );
        }

        if ( branchInfo.sha ) {
          if ( latestSHA === branchInfo.sha ) {
            selfDependencyNode.addChild( new UpToDateIcon( viewContext ) );
          }
          else {
            selfDependencyNode.addChild( new OutOfDateIcon( viewContext ) );
          }
        }
      } )().catch( e => { throw e; } );


      infoChildren.push( selfDependencyNode );
    }

    if ( branchInfo.isCheckedOut && branchInfo.branch === 'main' && branchInfo.dependencyRepos.length ) {
      const latestTimestamp = Math.max( ...Object.values( branchInfo.dependencyTimestampMap ) );

      const dependenciesContainerGridNode = new GridBox( {
        xAlign: 'left',
        xSpacing: 10,
        ySpacing: 3,
        children: [
          new UIText( 'Dependencies loading...' )
        ]
      } );

      const dependenciesTitleNode = new HBox( {
        spacing: 10,
        children: [
          new UIText( `Dependencies Last Updated: ${moment( latestTimestamp ).calendar()}` )
        ]
      } );

      const waitingNode = new WaitingNode( viewContext );
      disposeCallbacks.push( () => {
        waitingNode.dispose();
      } );

      dependenciesTitleNode.addChild( waitingNode );

      infoChildren.push( new UIAccordionBox( dependenciesContainerGridNode, {
        titleNode: dependenciesTitleNode
      } ) );

      ( async () => {
        const shaMap = await latestSHAsPromise;

        if ( dependenciesTitleNode.hasChild( waitingNode ) ) {
          dependenciesTitleNode.removeChild( waitingNode );
        }

        let allUpToDate = true;

        dependenciesContainerGridNode.rows = ( branchInfo.dependencyRepos.slice().sort() ).map( dependencyRepo => {
          const localSHA = branchInfo.dependencySHAMap[ dependencyRepo ];
          const latestSHA = shaMap[ dependencyRepo ];

          const isUpToDate = localSHA === latestSHA;

          if ( localSHA !== latestSHA ) {
            allUpToDate = false;
          }

          return [
            isUpToDate ? new UpToDateIcon( viewContext ) : new OutOfDateIcon( viewContext ),
            new UIText( dependencyRepo ),
            new UIText( localSHA.slice( 0, 7 ) ),
            isUpToDate ? null : new UIText( latestSHA.slice( 0, 7 ) ),
            new UIText( moment( branchInfo.dependencyTimestampMap[ dependencyRepo ] ).calendar() )
          ];
        } );

        if ( allUpToDate ) {
          dependenciesTitleNode.addChild( new UpToDateIcon( viewContext ) );
        }
        else {
          dependenciesTitleNode.addChild( new OutOfDateIcon( viewContext ) );
        }
      } )().catch( e => { throw e; } );
    }

    const customizationContainerNode = new Node();
    let customizationNode: CustomizationNode | null = null;
    const availableModes = getModes( repoListEntry, branchInfo, viewContext );

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

    disposeCallbacks.push( () => {
      customizationNode && customizationNode.dispose();
      customizationNode = null;
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
        spacing: 10
        // children: [
        //   new UIText( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? `Checkout updated: ${moment( branchInfo.lastUpdatedTime ).calendar()}` : 'Not checked out' ),
        //   new UITextPushButton( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? 'Update Checkout' : 'Check Out', {
        //     listener: async () => {
        //       showUpdating();
        //
        //       await apiUpdate( branchInfo.repo, branchInfo.branch );
        //       requestNewBranchInfo();
        //     }
        //   } )
        // ]
      } );

      areDependenciesUpToDatePromise.then( areUpToDate => {
        if ( !areUpToDate ) {
          updateStatusNode.children = [
            new UIText( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? `Checkout updated: ${moment( branchInfo.lastUpdatedTime ).calendar()}` : 'Not checked out' ),
            new UITextPushButton( branchInfo.isCheckedOut && branchInfo.lastUpdatedTime ? 'Update Checkout' : 'Check Out', {
              listener: async () => {
                showUpdating();

                await apiUpdate( branchInfo.repo, branchInfo.branch );
                requestNewBranchInfo();
              }
            } )
          ];
        }
      } ).catch( e => { throw e; } );

      infoChildren.push( updateContainer );
      infoChildren.push( updateStatusNode );

      if ( branchInfo.updateJobID !== null ) {
        showUpdating();

        ( async () => {
          await apiUpdateEvents( branchInfo.updateJobID! );
          requestNewBranchInfo();
        } )().catch( e => { throw e; } );
      }

      // TODO: show update status for release branches!!!! --- get them updated and built ideally --- allow rebuilds because of babel https://github.com/phetsims/phettest/issues/20
    }

    // Build status and button
    if ( repoListEntry.isRunnable && branchInfo.isCheckedOut ) {
      let isBuildableWithNewSHAs: boolean;
      if ( !branchInfo.lastBuiltTime ) {
        isBuildableWithNewSHAs = true;
      }
      else if ( branchInfo.branch === 'main' ) {
        isBuildableWithNewSHAs = !branchInfo.dependencyRepos.every( dependencyRepo => {
          if ( !( dependencyRepo in branchInfo.dependencySHAMap ) ) {
            return false;
          }
          const localSHA = branchInfo.dependencySHAMap[ dependencyRepo ];
          const latestBuildSHA = branchInfo.lastBuildSHAs[ dependencyRepo ];

          return localSHA === latestBuildSHA;
        } );
      }
      else {
        isBuildableWithNewSHAs = branchInfo.sha !== branchInfo.lastBuildSHAs[ branchInfo.repo ];
      }

      const buildStatusText = new UIText( branchInfo.lastBuiltTime === null ? 'No build available' : (
        isBuildableWithNewSHAs ? `Out Of Date Build: ${moment( branchInfo.lastBuiltTime ).calendar()}` : `Built: ${moment( branchInfo.lastBuiltTime ).calendar()}`
      ) );

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
          new UIAccordionBox( textNode, {
            titleNode: new HBox( {
              spacing: 5,
              children: [
                new UIText( 'Building...' ),
                waitingNode
              ],
              justify: 'left'
            } )
          } )
        ];

        const onOutput = ( str: string ) => {
          outputString += str;
          textNode.string = outputString;
        };

        return onOutput;
      };

      const buildButton = new UITextPushButton( branchInfo.lastBuiltTime ? ( isBuildableWithNewSHAs ? 'Update Build' : 'Force Re-Build' ) : 'Build', {
        opacity: isBuildableWithNewSHAs ? 1 : 0.6,
        scale: isBuildableWithNewSHAs ? 1 : 0.7,
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

          const success = await apiBuildEvents( branchInfo.buildJobID!, getBuildOnOutput() );

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