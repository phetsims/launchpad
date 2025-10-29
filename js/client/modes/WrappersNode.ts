// Copyright 2025, University of Colorado Boulder

/**
 * Customization for wrappers list
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Repo } from '../../types/common-types.js';
import { HBox, Node } from 'scenerystack/scenery';
import { WaitingNode } from '../WaitingNode.js';
import { ViewContext } from '../ViewContext.js';
import { UIText } from '../UIText.js';
import { UIAquaRadioButtonGroup } from '../UIAquaRadioButtonGroup.js';
import { Property } from 'scenerystack/axon';
import { getWrappers } from '../client-api.js';
import { getWrapperName } from './getWrapperName.js';

export class WrappersNode extends Node {
  private readonly wrapperProperty = new Property( 'phet-io-wrappers/index' );

  public constructor(
    public readonly repo: Repo,
    public readonly simSpecificWrappers: string[],
    private readonly releaseBranchPrefix: string,
    viewContext: ViewContext
  ) {
    super();

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

      this.children = [
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

    // add recording to the console by default
    if ( wrapper === 'phet-io-wrappers/record' ) {
      url += '&console';
    }

    return url;
  }
}