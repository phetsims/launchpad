// Copyright 2025, University of Colorado Boulder

/**
 * Runnable links, with separate unbuilt/built customization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, QueryParameter, RepoListEntry } from '../../types/common-types.js';
import { VBox } from 'scenerystack/scenery';
import { ViewContext } from '../ViewContext.js';
import { BooleanProperty } from 'scenerystack/axon';
import { useBuiltProperty } from '../settings.js';
import { UITextSwitch } from '../UITextSwitch.js';
import { QueryParametersNode } from './QueryParameterNode.js';

export class SimpleUnbuiltBuiltCustomizationNode extends VBox {
  private queryParametersNode: QueryParametersNode | null = null;

  public constructor(
    public readonly repoListEntry: RepoListEntry,
    public readonly branchInfo: BranchInfo,
    public unbuiltURL: string | null,
    public builtURL: string | null,
    public queryParametersPromise: Promise<QueryParameter[]>,
    viewContext: ViewContext,
    defaultUnbuiltObject: Record<string, unknown> = {},
    defaultBuiltObject: Record<string, unknown> = {}
  ) {
    super( {
      align: 'left',
      spacing: 15
    } );

    const hasBoth = unbuiltURL !== null && builtURL !== null;

    const showBuiltProperty = hasBoth ? useBuiltProperty : new BooleanProperty( unbuiltURL === null );

    const textSwitch = new UITextSwitch( showBuiltProperty, 'Use Built Version', {
      onOffSwitchOptions: {
        enabled: hasBoth
      }
    } );

    this.addDisposable( textSwitch );
    this.addChild( textSwitch );

    const showBuiltListener = ( built: boolean ) => {
      if ( this.queryParametersNode ) {
        this.queryParametersNode.dispose();
      }

      this.queryParametersNode = new QueryParametersNode( repoListEntry, branchInfo, built ? defaultBuiltObject : defaultUnbuiltObject, queryParametersPromise, viewContext );

      this.addChild( this.queryParametersNode );
    };

    showBuiltProperty.link( showBuiltListener );
    this.disposeEmitter.addListener( () => {
      showBuiltProperty.unlink( showBuiltListener );

      if ( this.queryParametersNode ) {
        this.queryParametersNode.dispose();
      }
    } );

    if ( !unbuiltURL && !builtURL ) {
      throw new Error( 'At least one URL must be provided' );
    }
  }

  public getURL(): string {
    let baseURL: string;
    if ( this.unbuiltURL && this.builtURL ) {
      baseURL = useBuiltProperty.value ? this.builtURL : this.unbuiltURL;
    }
    else if ( this.builtURL ) {
      baseURL = this.builtURL;
    }
    else if ( this.unbuiltURL ) {
      baseURL = this.unbuiltURL;
    }
    else {
      throw new Error( 'No URL available' );
    }

    const queryParameterObject = this.queryParametersNode!.getQueryParameterObject();
    const queryParameterStrings = Object.keys( queryParameterObject ).map( key => {
      const value = queryParameterObject[ key ];

      if ( value === undefined ) {
        return `${encodeURIComponent( key )}`; // key only (flag)
      }
      else {
        return `${encodeURIComponent( key )}=${encodeURIComponent( `${value}` )}`;
      }
    } );
    if ( queryParameterStrings.length > 0 ) {
      return `${baseURL}${baseURL.includes( '?' ) ? '&' : '?'}${queryParameterStrings.join( '&' )}`;
    }
    else {
      return baseURL;
    }
  }
}