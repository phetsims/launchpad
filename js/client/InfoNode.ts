// Copyright 2025, University of Colorado Boulder

/**
 * Info node
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { PopupNode } from './PopupNode.js';
import { UIText } from './UIText.js';
import { ViewContext } from './ViewContext.js';
import { VBox } from 'scenerystack/scenery';
import { keyFillColorProperty, keyShadowColorProperty, keyTextColorProperty, uiHeaderFont } from './theme.js';
import { UIRichText } from './UIRichText.js';
import { ArrowKeyNode, ArrowKeyNodeOptions, KeyboardHelpIconFactory, TextKeyNode, TextKeyNodeOptions } from 'scenerystack/scenery-phet';

const textKeyOptions: TextKeyNodeOptions = {
  fill: keyTextColorProperty,
  keyFill: keyFillColorProperty,
  keyShadowFill: keyShadowColorProperty
};

const arrowKeyOptions: ArrowKeyNodeOptions = {
  arrowFill: keyTextColorProperty,
  arrowStroke: keyTextColorProperty,
  keyFill: keyFillColorProperty,
  keyShadowFill: keyShadowColorProperty
};

const LINE_WRAP = 700;

export class InfoNode extends PopupNode {
  public constructor( viewContext: ViewContext ) {
    super(
      new VBox( {
        spacing: 20,
        align: 'left',
        stretch: true,
        children: [
          new UIText( 'Documentation', {
            font: uiHeaderFont,
            layoutOptions: {
              align: 'center'
            }
          } ),

          new UIText( 'Launching Simulations', { font: uiHeaderFont } ),

          new UIRichText( 'Select a simulation from the list on the left. Then you can select a mode to launch (e.g. "phet", or "studio") on the list to its right.', {
            lineWrap: LINE_WRAP
          } ),

          new UIRichText( 'Pressing <node id="enter" align="center"/> at any point will launch the selected simulation/mode. Additionally, double-clicking an item (or clicking a selected item) in the simulation or mode lists will also launch.', {
            lineWrap: LINE_WRAP,
            nodes: {
              enter: TextKeyNode.enter( textKeyOptions )
            }
          } ),

          new UIRichText( 'Release branches (instead of main) can be selected from the dropdown at the top of the repository, if available.', {
            lineWrap: LINE_WRAP
          } ),

          new UIText( 'Search Box', { font: uiHeaderFont } ),

          new UIRichText( 'The search box will filter simulations as you type. It uses a fuzzy search, so you can type parts of words and they do not need to be in order (e.g. "string wave" will select wave-on-a-string).', {
            lineWrap: LINE_WRAP
          } ),

          new UIRichText( 'The search box will be focused when launchpad loads, so it is fastest to start typing a simulation name immediately.', {
            lineWrap: LINE_WRAP
          } ),

          new UIRichText( 'Putting a dash (\'-\') in front of a search word will cause that word to filter the available modes. For example, typing "ball -stu" and then pressing <node id="enter" align="center"/> will select the "studio" mode for balloons-and-static-electricity and launch it.', {
            lineWrap: LINE_WRAP,
            nodes: {
              enter: TextKeyNode.enter( textKeyOptions )
            }
          } ),

          new UIRichText( 'Putting a numeric release branch (e.g. "1.4") in the search box will select that branch for the simulation, if it exists', {
            lineWrap: LINE_WRAP
          } ),

          new UIRichText( 'While the search box is focused, <node id="arrows" align="center"/> will navigate the simulation list', {
            lineWrap: LINE_WRAP,
            nodes: {
              arrows: KeyboardHelpIconFactory.iconRow( [ new ArrowKeyNode( 'up', arrowKeyOptions ), new ArrowKeyNode( 'down', arrowKeyOptions ) ] )
            }
          } )
        ]
      } ),
      viewContext
    );
  }
}
