// Copyright 2025, University of Colorado Boulder

/**
 * Settings node
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { PopupNode } from './PopupNode.js';
import { UIText } from './UIText.js';
import { ViewContext } from './ViewContext.js';
import { HBox, Node, VBox } from 'scenerystack/scenery';
import { UIAquaRadioButtonGroup } from './UIAquaRadioButtonGroup.js';
import { LaunchType } from './LaunchType.js';
import { launchTypeProperty, repoFilterTypeProperty, showAdvancedProperty } from './settings.js';
import { ColorTheme, colorThemeProperty, uiHeaderFont } from './theme.js';
import { RepoFilterType } from './RepoFilterType.js';
import { UITextSwitch } from './UITextSwitch.js';

export class SettingsNode extends PopupNode {
  public constructor( viewContext: ViewContext ) {
    // const tooltipListener = new TooltipListener( viewContext );

    const createInsetGroup = ( label: string, content: Node ) => {
      return new VBox( {
        spacing: 5,
        align: 'left',
        stretch: true,
        children: [
          new UIText( label ),
          new HBox( {
            children: [ content ],
            layoutOptions: {
              leftMargin: 20
            }
          } )
        ]
      } );
    };

    super(
      new VBox( {
        spacing: 20,
        align: 'left',
        stretch: true,
        children: [
          new UIText( 'Settings', {
            font: uiHeaderFont
          } ),
          createInsetGroup( 'Launch In:', new UIAquaRadioButtonGroup( launchTypeProperty, [
            {
              value: LaunchType.SAME_TAB,
              createNode: () => new UIText( 'Same Tab' )
            },
            {
              value: LaunchType.NEW_TAB,
              createNode: () => new UIText( 'New Tab' )
            }
          ], {
            orientation: 'vertical',
            align: 'center',
            spacing: 5
          } ) ),
          createInsetGroup( 'Color Theme:', new UIAquaRadioButtonGroup( colorThemeProperty, [
            {
              value: ColorTheme.AUTO,
              createNode: () => new UIText( 'Auto' )
            },
            {
              value: ColorTheme.LIGHT,
              createNode: () => new UIText( 'Light' )
            },
            {
              value: ColorTheme.DARK,
              createNode: () => new UIText( 'Dark' )
            }
          ], {
            orientation: 'vertical',
            align: 'center',
            spacing: 5
          } ) ),
          createInsetGroup( 'Repository List:', new UIAquaRadioButtonGroup( repoFilterTypeProperty, [
            {
              value: RepoFilterType.ALL,
              createNode: () => new UIText( 'Show All' )
            },
            {
              value: RepoFilterType.RUNNABLES,
              createNode: () => new UIText( 'Show Only Runnable Repos' )
            },
            {
              value: RepoFilterType.SIMULATIONS,
              createNode: () => new UIText( 'Show Only Simulations' )
            }
          ], {
            orientation: 'vertical',
            align: 'center',
            spacing: 5
          } ) ),
          new UITextSwitch( showAdvancedProperty, 'Show Advanced Options' )
        ]
      } ),
      viewContext
    );
  }
}
