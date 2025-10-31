// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

// NOTE: This is required first (to turn on assertions)
import './clientQueryParameters.js';

import { Property, stepTimer } from 'scenerystack/axon';
import { Bounds2 } from 'scenerystack/dot';
import { platform } from 'scenerystack/phet-core';
import { AlignBox, AlignGroup, Display, HBox, Image, Node, Path, pdomFocusProperty, Rectangle, VBox } from 'scenerystack/scenery';
import { SearchBoxNode } from './SearchBoxNode.js';
import type { RepoList } from '../types/common-types.js';
import { apiGetRepoList } from './client-api.js';
import { RepoListNode } from './RepoListNode.js';
import { RepoNode } from './RepoNode.js';
import { ViewContext } from './ViewContext.js';
import { preferencesIconOnWhite_png } from 'scenerystack/joist';
import { uiBackgroundColorProperty, uiButtonForegroundProperty, uiHeaderFont } from './theme.js';
import { showAdvancedProperty } from './settings.js';
import { SettingsNode } from './SettingsNode.js';
import { UIRectangularPushButton } from './UIRectangularPushButton.js';
import { UIText } from './UIText.js';
import { LogNode } from './LogNode.js';
import { UITextPushButton } from './UITextPushButton.js';
import { launchURL } from './launchURL.js';
import { infoCircleSolidShape } from 'scenerystack/sun';
import { InfoNode } from './InfoNode.js';
import { TooltipListener } from './TooltipListener.js';
import { ModeListNode } from './ModeListNode.js';

const selectedRepoProperty = new Property<string | null>( null );
const searchBoxTextProperty = new Property( '' );
const repoListProperty = new Property<RepoList | null>( null );
const modeListNodeProperty = new Property<ModeListNode | null>( null );

selectedRepoProperty.lazyLink( repo => {
  if ( repo ) {
    localStorage.setItem( 'lastSelectedRepo', repo );
  }
} );

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

uiBackgroundColorProperty.link( backgroundColor => {
  display.backgroundColor = backgroundColor;
} );

document.body.appendChild( display.domElement );

display.initializeEvents();

const glassPane = new Node();

const viewContext = new ViewContext( layoutBoundsProperty, glassPane, stepTimer );

const tooltipListener = new TooltipListener( viewContext );

const searchBoxNode = new SearchBoxNode( searchBoxTextProperty );
const repoListNode = new RepoListNode( repoListProperty, searchBoxTextProperty, selectedRepoProperty, searchBoxNode.isElementFocusedProperty, viewContext );
const repoNodeContainer = new Node();
selectedRepoProperty.link( selectedRepo => {
  const repoListEntry = repoListProperty.value?.find( repo => repo.name === selectedRepo ) ?? null;

  if ( repoListEntry ) {
    const oldChildren = repoNodeContainer.children.slice();
    repoNodeContainer.children = selectedRepo ? [
      new RepoNode( repoListEntry, searchBoxTextProperty, modeListNodeProperty, launchURL, viewContext )
    ] : [];
    oldChildren.forEach( child => child.dispose() );
  }
} );

let logNode: LogNode | null = null;
const logButton = new UITextPushButton( 'Log', {
  listener: () => {
    logNode = logNode || new LogNode( viewContext );

    logNode.show();
  },
  visibleProperty: showAdvancedProperty
} );

const topButtonAlignGroup = new AlignGroup();

let settingsNode: SettingsNode | null = null;
let infoNode: InfoNode | null = null;
const settingsImage = new Image( preferencesIconOnWhite_png, {
  scale: 0.15
} );

// TODO: add tooltips!
const settingsButton = new UIRectangularPushButton( {
  content: topButtonAlignGroup.createBox( settingsImage ),
  accessibleName: 'Settings',
  listener: () => {
    settingsNode = settingsNode || new SettingsNode( viewContext );

    settingsNode.show();
  },
  layoutOptions: { grow: 1 }
} );
settingsButton.addInputListener( tooltipListener );
const infoButton = new UIRectangularPushButton( {
  content: topButtonAlignGroup.createBox( new Path( infoCircleSolidShape, {
    scale: 0.7,
    fill: uiButtonForegroundProperty
  } ) ),
  accessibleName: 'Info and Documentation',
  listener: () => {
    infoNode = infoNode || new InfoNode( viewContext );

    infoNode.show();
  },
  layoutOptions: { grow: 1 }
} );
infoButton.addInputListener( tooltipListener );

const titleNode = new UIText( 'Launchpad', {
  font: uiHeaderFont
} );

const baseBox = new VBox( {
  align: 'left',
  spacing: 10,
  children: [
    new HBox( {
      align: 'center',
      spacing: 50,
      stretch: true,
      children: [
        ...( location.hostname !== 'bayes.colorado.edu' ? [
          new HBox( {
            spacing: 10,
            children: [
              titleNode,
              new UIText( `(${location.hostname})`, {
                opacity: 0.5
              } )
            ]
          } )
        ] : [
          titleNode
        ] ),
        searchBoxNode,
        new HBox( {
          spacing: 10,
          children: [
            logButton,
            infoButton,
            settingsButton
          ]
        } )
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

modeListNodeProperty.link( modeListNode => {
  baseBox.pdomOrder = [
    searchBoxNode,
    repoListNode,
    ...( modeListNode ? [ modeListNode ] : [] ),
    logButton,
    infoButton,
    settingsButton,
    repoNodeContainer,
    null
  ];
} );

const MAIN_MARGIN = 10;

layoutBoundsProperty.link( layoutBounds => {
  baseBox.preferredWidth = layoutBounds.width - 2 * MAIN_MARGIN;
} );

const alignBox = new AlignBox( baseBox, {
  margin: MAIN_MARGIN
} );

pdomFocusProperty.lazyLink( focus => {
  if ( focus ) {
    const trail = focus.trail;

    const bounds = trail.parentToGlobalBounds( focus.trail.lastNode().bounds );

    const currentWindowBounds = new Bounds2( window.scrollX, window.scrollY, window.scrollX + window.innerWidth, window.scrollY + window.innerHeight );

    if ( !currentWindowBounds.containsBounds( bounds ) ) {
      // current values
      const x = window.scrollX;
      let y = window.scrollY;

      const topMatchY = bounds.top;
      const bottomMatchY = bounds.bottom - window.innerHeight;

      if ( y < bottomMatchY ) {
        y = bottomMatchY;
      }
      if ( y > topMatchY ) {
        y = topMatchY;
      }

      scrollTo( {
        top: y,
        left: x,
        behavior: 'smooth'
      } );
    }
  }
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
searchBoxNode.focus();