// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { enableAssert } from 'scenerystack/assert';
import { Property, stepTimer } from 'scenerystack/axon';
import { Bounds2 } from 'scenerystack/dot';
import { platform } from 'scenerystack/phet-core';
import { AlignBox, Display, HBox, Node, Text, VBox } from 'scenerystack/scenery';
import { AquaRadioButtonGroup } from 'scenerystack/sun';
import { SearchBoxNode } from './SearchBoxNode.js';
import type { RepoList } from '../types/common-types.js';
import { apiGetRepoList } from './client-api.js';
import { RepoListNode } from './RepoListNode.js';
import { RepoNode } from './RepoNode.js';
import { LocalStorageEnumerationProperty } from './localStorage.js';
import { LaunchType } from './LaunchType.js';
import { ViewContext } from './ViewContext.js';

// eslint-disable-next-line no-undef
if ( process.env.NODE_ENV === 'development' ) {
  // Enable assertions if we are in development mode
  enableAssert();
}

const selectedRepoProperty = new Property<string | null>( null );
const searchBoxTextProperty = new Property( '' );
const repoListProperty = new Property<RepoList | null>( null );
const launchTypeProperty = new LocalStorageEnumerationProperty( 'launchType', LaunchType.SAME_TAB );

( async () => {
  repoListProperty.value = await apiGetRepoList();
} )().catch( e => {
  throw e;
} );

// Tracks the bounds of the window (can listen with layoutBoundsProperty.link)
export const layoutBoundsProperty = new Property(
  new Bounds2( 0, 0, window.innerWidth, window.innerHeight )
);

// The root node of the scene graph (all Scenery content will be placed in here)
const rootNode = new Node();

const display = new Display( rootNode, {
  backgroundColor: '#eee',
  allowWebGL: true,
  allowBackingScaleAntialiasing: true,
  allowSceneOverflow: false,
  allowCSSHacks: true,
  accessibility: true,
  assumeFullWindow: false,
  listenToOnlyElement: true,
  passiveEvents: true
} );

document.body.appendChild( display.domElement );

display.initializeEvents();

const glassPane = new Node();

const viewContext = new ViewContext( layoutBoundsProperty, glassPane, stepTimer );

const launchURL = ( url: string ) => {
  const launchType = launchTypeProperty.value;

  if ( launchType === LaunchType.SAME_TAB ) {
    window.location.href = url;
  }
  else if ( launchType === LaunchType.NEW_TAB ) {
    const popupWindow = window.open( url, '_blank' );
    popupWindow && popupWindow.focus();
  }
};

const searchBoxNode = new SearchBoxNode( searchBoxTextProperty );
const repoListNode = new RepoListNode( repoListProperty, searchBoxTextProperty, selectedRepoProperty, viewContext );
const repoNodeContainer = new Node();
selectedRepoProperty.link( selectedRepo => {
  const repoListEntry = repoListProperty.value?.find( repo => repo.name === selectedRepo ) ?? null;

  if ( repoListEntry ) {
    const oldChildren = repoNodeContainer.children.slice();
    repoNodeContainer.children = selectedRepo ? [
      new RepoNode( repoListEntry, searchBoxTextProperty, launchURL, viewContext )
    ] : [];
    oldChildren.forEach( child => child.dispose() );
  }
} );
const launchTypeRadioButtonGroup = new AquaRadioButtonGroup( launchTypeProperty, [
  {
    value: LaunchType.SAME_TAB,
    createNode: () => new Text( 'Launch in Same Tab', { font: '14px sans-serif' } )
  },
  {
    value: LaunchType.NEW_TAB,
    createNode: () => new Text( 'Launch in New Tab', { font: '14px sans-serif' } )
  }
], {
  orientation: 'horizontal',
  align: 'center',
  spacing: 30
} );

const baseBox = new VBox( {
  align: 'left',
  spacing: 10,
  children: [
    new HBox( {
      align: 'center',
      spacing: 50,
      children: [
        new Text( 'Launchpad', {
          font: '24px sans-serif'
        } ),
        searchBoxNode,
        launchTypeRadioButtonGroup
      ]
    } ),
    new HBox( {
      spacing: 30,
      align: 'top',
      children: [
        repoListNode,
        repoNodeContainer
      ]
    } )
  ]
} );

const alignBox = new AlignBox( baseBox, {
  margin: 10
} );

alignBox.localBoundsProperty.link( () => {
  alignBox.left = 0;
  alignBox.top = 0;
} );

rootNode.children = [
  alignBox,
  glassPane
];

// Lazy resizing logic
let resizePending = true;
const resize = () => {
  resizePending = false;

  const layoutBounds = new Bounds2( 0, 0, window.innerWidth, window.innerHeight );
  display.width = layoutBounds.width;
  layoutBoundsProperty.value = layoutBounds;

  if ( platform.mobileSafari ) {
    window.scrollTo( 0, 0 );
  }
};
const resizeListener = () => {
  resizePending = true;
};
window.addEventListener( 'resize', resizeListener );
window.addEventListener( 'orientationchange', resizeListener );
window.visualViewport &&
  window.visualViewport.addEventListener( 'resize', resizeListener );
resize();

// Frame step logic
display.updateOnRequestAnimationFrame( () => {
  if ( resizePending ) {
    resize();
  }

  const fullHeight = Math.max( Math.ceil( alignBox.height ), window.innerHeight );
  if ( display.height !== fullHeight ) {
    display.height = fullHeight;
  }
} );

display.initializeEvents();
display.updateDisplay();
searchBoxNode.focusSearchBox();