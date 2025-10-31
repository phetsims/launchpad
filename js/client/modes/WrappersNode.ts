// Copyright 2025, University of Colorado Boulder

/**
 * Customization for wrappers list
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Repo } from '../../types/common-types.js';
import { HBox, VBox } from 'scenerystack/scenery';
import { WaitingNode } from '../WaitingNode.js';
import { ViewContext } from '../ViewContext.js';
import { UIText } from '../UIText.js';
import { UIAquaRadioButtonGroup } from '../UIAquaRadioButtonGroup.js';
import { BooleanProperty, Property } from 'scenerystack/axon';
import { getWrappers } from '../client-api.js';
import { getWrapperName } from './getWrapperName.js';
import { useBuiltProperty } from '../settings.js';
import { UITextSwitch } from '../UITextSwitch.js';

export class WrappersNode extends VBox {
  private readonly wrapperProperty = new Property( 'phet-io-wrappers/index' );
  private readonly showBuiltProperty!: Property<boolean>;

  public constructor(
    public readonly repo: Repo,
    public readonly isBuilt: boolean,
    public readonly simSpecificWrappers: string[],
    private readonly releaseBranchPrefix: string,
    private readonly phetioFolder: string,
    viewContext: ViewContext
  ) {
    super( {
      align: 'left',
      spacing: 15
    } );

    this.showBuiltProperty = isBuilt ? useBuiltProperty : new BooleanProperty( false );

    const waitingNode = new WaitingNode( viewContext );

    this.addDisposable( waitingNode );

    this.children = [ new HBox( {
      spacing: 10,
      children: [
        new UIText( 'Loading wrappers...' ),
        waitingNode
      ]
    } ) ];

    ( async () => {
      const wrappers = [
        ...( await getWrappers() ),
        ...simSpecificWrappers
      ];

      // this.wrapperProperty.value = wrappers.find( wrapper => getWrapperName( wrapper ) === 'index' )!;
      // console.log( this.wrapperProperty.value );

      wrappers.sort( ( a, b ) => {
        const aIndex = getWrapperName( a ) === 'index';
        const bIndex = getWrapperName( b ) === 'index';
        if ( aIndex && !bIndex ) {
          return -1;
        }
        else if ( bIndex && !aIndex ) {
          return 1;
        }
        return a.localeCompare( b );
      } );

      const textSwitch = new UITextSwitch( this.showBuiltProperty, 'Use Built Version', {
        onOffSwitchOptions: {
          enabled: isBuilt
        }
      } );

      this.addDisposable( textSwitch );

      this.children = [
        textSwitch,
        new UIAquaRadioButtonGroup( this.wrapperProperty, wrappers.map( wrapper => {
          return {
            value: wrapper,
            createNode: () => new UIText( getWrapperName( wrapper ) )
          };
        } ) )
      ];
    } )().catch( e => { throw e; } );
  }

  public getURL(): string {
    const wrapper = this.wrapperProperty.value;
    const wrapperName = getWrapperName( wrapper );
    let url: string;

    // TODO: &phetioDebug=true&phetioWrapperDebug=true ???

    if ( this.showBuiltProperty.value ) {
      if ( wrapperName === 'index' ) {
        url = `${this.releaseBranchPrefix}${this.repo}/build${this.phetioFolder}/`;
      }
      else {
        url = `${this.releaseBranchPrefix}${this.repo}/build${this.phetioFolder}/wrappers/${wrapperName}/`;
      }
    }
    else {
      // Process for dedicated wrapper repos
      if ( wrapper.startsWith( 'phet-io-wrapper-' ) ) {

        // Special use case for the sonification wrapper
        url = wrapperName === 'sonification' ? `${this.releaseBranchPrefix}phet-io-wrapper-${wrapperName}/${this.repo}-sonification.html?sim=${this.repo}` :
              `${this.releaseBranchPrefix}${wrapper}/?sim=${this.repo}`;
      }
      // Load the wrapper urls for the phet-io-wrappers/
      else {
        url = `${this.releaseBranchPrefix}${wrapper}/?sim=${this.repo}`;
      }
    }

    // add recording to the console by default
    if ( wrapper === 'phet-io-wrappers/record' ) {
      url += '&console';
    }

    return url;
  }
}