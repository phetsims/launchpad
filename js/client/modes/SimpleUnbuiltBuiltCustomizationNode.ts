// Copyright 2025, University of Colorado Boulder

/**
 * Runnable links, with separate unbuilt/built customization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, QueryParameter, RepoListEntry } from '../../types/common-types.js';
import { HBox, VBox } from 'scenerystack/scenery';
import { ViewContext } from '../ViewContext.js';
import { BooleanProperty, DerivedProperty } from 'scenerystack/axon';
import { useBuiltProperty, useLiveModulifyProperty } from '../settings.js';
import { UITextSwitch } from '../UITextSwitch.js';
import { QueryParametersNode } from './QueryParameterNode.js';
import { TooltipListener } from '../TooltipListener.js';
import { isBuildOutOfDate } from '../isBuildOutOfDate.js';
import { warningColorProperty } from '../theme.js';
import { UIText } from '../UIText.js';

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

    const switchesBox = new HBox( {
      spacing: 30
    } );
    this.addChild( switchesBox );

    const useBuiltSwitch = new UITextSwitch( showBuiltProperty, 'Built Version', {
      onOffSwitchOptions: {
        enabled: hasBoth
      }
    } );
    useBuiltSwitch.addInputListener( new TooltipListener( viewContext, 'Launches the built form of the sim' ) );

    this.addDisposable( useBuiltSwitch );
    switchesBox.addChild( useBuiltSwitch );

    if ( unbuiltURL !== null && branchInfo.branch === 'main' ) {
      const useLiveModulifyEnabledProperty = new DerivedProperty( [ showBuiltProperty ], showBuilt => !showBuilt );
      const useLiveModulifySwitch = new UITextSwitch( useLiveModulifyProperty, 'Live Modulify', {
        visibleProperty: useLiveModulifyEnabledProperty
      } );
      useLiveModulifySwitch.addInputListener( new TooltipListener( viewContext, 'Launches using latest strings/resources, instead of intermediate checked-in code' ) );

      this.addDisposable( useLiveModulifyEnabledProperty );
      this.addDisposable( useLiveModulifySwitch );
      switchesBox.addChild( useLiveModulifySwitch );
    }

    if ( branchInfo.lastBuiltTime && isBuildOutOfDate( branchInfo ) && builtURL ) {
      const outOfDateText = new UIText( 'WARNING: Build is out of date', {
        fill: warningColorProperty,
        visibleProperty: showBuiltProperty
      } );

      this.addDisposable( outOfDateText );
      this.addChild( outOfDateText );
    }

    const showBuiltListener = ( built: boolean ) => {
      if ( this.queryParametersNode ) {
        this.queryParametersNode.dispose();
      }

      this.queryParametersNode = new QueryParametersNode( built ? defaultBuiltObject : defaultUnbuiltObject, queryParametersPromise, viewContext );

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
    const useLiveModulify = this.branchInfo.branch === 'main' && useLiveModulifyProperty.value;

    const builtURL = this.builtURL;
    const unbuiltURL = this.unbuiltURL ? `${useLiveModulify ? 'live/' : ''}${this.unbuiltURL}` : this.unbuiltURL;

    let baseURL: string;
    if ( unbuiltURL && builtURL ) {
      baseURL = useBuiltProperty.value ? builtURL : unbuiltURL;
    }
    else if ( builtURL ) {
      baseURL = builtURL;
    }
    else if ( unbuiltURL ) {
      baseURL = unbuiltURL;
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
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
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