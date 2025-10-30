// Copyright 2025, University of Colorado Boulder

/**
 * Query parameters customization
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, QueryParameter, RepoListEntry } from '../../types/common-types.js';
import { UIRichText } from '../UIRichText.js';
import { UISwitch } from '../UISwitch.js';
import { UIAquaRadioButtonGroup } from '../UIAquaRadioButtonGroup.js';
import { UIText } from '../UIText.js';
import { autocompleteMatchColorProperty, queryParameterDocFont, uiButtonForegroundProperty, uiForegroundColorProperty } from '../theme.js';
import { UIAccordionBox } from '../UIAccordionBox.js';
import { ViewContext } from '../ViewContext.js';
import { WaitingNode } from '../WaitingNode.js';
import { clientSleep } from '../clientSleep.js';
import { Color, DOM, HBox, Node, Path, VBox } from 'scenerystack/scenery';
import { BooleanProperty, DerivedProperty, Multilink, Property, StringProperty } from 'scenerystack/axon';
import { getInputCSSProperty } from '../css.js';
import { SearchBoxNode } from '../SearchBoxNode.js';
import { UITextSwitch } from '../UITextSwitch.js';
import fuzzysort from 'fuzzysort';
import { favoriteQueryParametersProperty } from '../settings.js';
import { UIBooleanRectangularStickyToggleButton } from '../UIBooleanRectangularStickyToggleButton.js';
import { Shape } from 'scenerystack/kite';
import { Matrix3 } from 'scenerystack/dot';
import { TooltipListener } from '../TooltipListener.js';

class PlaceholderQueryParameterNode extends UIText {
  public constructor(
    public readonly name: string,
    public readonly value: unknown
  ) {
    // eslint-disable-next-line @typescript-eslint/no-base-to-string
    super( `${name}${value === undefined ? '' : `=${value}`}` );
  }
}

class QueryParameterNode extends VBox {
  private readonly valueProperty: Property<unknown>;

  public constructor(
    public readonly queryParameter: QueryParameter,
    public readonly highlight: ( before: string, after: string ) => string,
    public readonly object: Record<string, unknown>,
    public readonly defaultValue: unknown,
    viewContext: ViewContext
  ) {
    super( {
      align: 'left',
      spacing: 3,
      stretch: true
    } );

    const hasObjectValue = object.hasOwnProperty( queryParameter.name );

    // If we are a flag, our value would be undefined (so it isn't written with a `=`), so we use presence as true
    this.valueProperty = new Property( queryParameter.type === 'flag' ? hasObjectValue : defaultValue );

    // Will fill in strings below with listener to color
    const nameInfoRichText = new UIRichText( '' );

    const isFavoriteProperty = new BooleanProperty( favoriteQueryParametersProperty.value.includes( queryParameter.name ) );
    isFavoriteProperty.lazyLink( isFavorite => {
      if ( isFavorite ) {
        favoriteQueryParametersProperty.value = Array.from( new Set( [
          ...favoriteQueryParametersProperty.value,
          queryParameter.name
        ] ) );
      }
      else {
        favoriteQueryParametersProperty.value = favoriteQueryParametersProperty.value.filter( name => name !== queryParameter.name );
      }
    } );

    const heartIcon = new Path( new Shape( 'M0 200 v-200 h200 a100,100 90 0,1 0,200 a100,100 90 0,1 -200,0 z' ).transformed( Matrix3.rotation2( -0.75 * Math.PI ).timesMatrix( Matrix3.scale( 0.04 ) ) ), {
      fill: new DerivedProperty( [ isFavoriteProperty, uiButtonForegroundProperty, uiForegroundColorProperty ], ( isFavorite, buttonForeground, uiForeground ) => {
        return isFavorite ? buttonForeground : null;
      } ),
      stroke: new DerivedProperty( [ isFavoriteProperty, uiButtonForegroundProperty, uiForegroundColorProperty ], ( isFavorite, buttonForeground, uiForeground ) => {
        return isFavorite ? null : uiForeground;
      } )
    } );

    const heartButton = new UIBooleanRectangularStickyToggleButton( isFavoriteProperty, {
      content: heartIcon
    } );

    heartButton.addInputListener( new TooltipListener( viewContext, 'Add/Remove from "favorites", which will show up without being searched' ) );

    const nameInfoNode = new HBox( {
      justify: 'left',
      spacing: 5,
      children: [
        nameInfoRichText,
        new UIText( `(${queryParameter.repo} ${queryParameter.type}${
        queryParameter.private ? ' private' : ''
      }${
        queryParameter.public ? ' public' : ''
      })`, {
          opacity: 0.6,
          scale: 0.7
        } ),
        heartButton
      ]
    } );

    const highlightListener = ( color: Color ) => {
      const cssColor = color.toCSS();
      nameInfoRichText.string = highlight( `<b style="color: ${cssColor};">`, '</b>' );
    };
    autocompleteMatchColorProperty.link( highlightListener );
    this.disposeEmitter.addListener( () => {
      autocompleteMatchColorProperty.unlink( highlightListener );
    } );

    // NOTE: we could create subclasses for each type
    if ( queryParameter.type === 'flag' ) {
      this.addChild( new UISwitch( this.valueProperty as Property<boolean>, queryParameter.name, nameInfoNode ) );
    }
    else if ( queryParameter.type === 'boolean' && typeof queryParameter.defaultValue === 'boolean' ) {
      const isTrueProperty = new BooleanProperty( hasObjectValue ? defaultValue as boolean : queryParameter.defaultValue );

      this.addChild( new UISwitch( isTrueProperty, queryParameter.name, nameInfoNode ) );

      isTrueProperty.link( isTrue => {
        if ( isTrue !== queryParameter.defaultValue ) {
          this.valueProperty.value = isTrue;
        }
        else {
          this.valueProperty.value = undefined;
        }
      } );
    }
    else if ( queryParameter.type === 'boolean' && queryParameter.defaultValue === undefined ) {
      this.addChild( new VBox( {
        align: 'left',
        spacing: 3,
        children: [
          nameInfoNode,
          new UIAquaRadioButtonGroup( this.valueProperty as Property<boolean | undefined>, [
            {
              value: undefined,
              createNode: () => new UIText( 'default (undefined)' )
            },
            {
              value: true,
              createNode: () => new UIText( 'true' )
            },
            {
              value: false,
              createNode: () => new UIText( 'false' )
            }
          ], { layoutOptions: { leftMargin: 20 } } )
        ]
      } ) );
    }
    else if ( queryParameter.validValues ) {
      let property: Property<unknown>;
      if ( queryParameter.defaultValue && queryParameter.validValues.includes( queryParameter.defaultValue ) ) {

        // We don't want to send default values, but we want to have a Property that has them exist for the aqua radio button group
        property = new Property<unknown>( this.valueProperty.value ?? queryParameter.defaultValue );

        property.link( value => {
          if ( value === queryParameter.defaultValue ) {
            this.valueProperty.value = undefined;
          }
          else {
            this.valueProperty.value = value;
          }
        } );
      }
      else {
        property = this.valueProperty;
      }

      this.addChild( new VBox( {
        align: 'left',
        spacing: 3,
        children: [
          nameInfoNode,
          new UIAquaRadioButtonGroup( property, queryParameter.validValues.map( ( value: unknown ) => {
            return {
              value: value,
              createNode: () => new UIText( `${value}${queryParameter.name === 'locale' ? ` (${phet.chipper.localeData[ value as string ].englishName})` : ''}` )
            };
          } ), { layoutOptions: { leftMargin: 20 } } )
        ]
      } ) );
    }
    else {
      const input = document.createElement( 'input' );

      getInputCSSProperty( 250, { padding: 0 } ).link( cssText => {
        input.style.cssText = cssText;
      } );
      input.type = 'text';
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      input.placeholder = queryParameter.defaultValue !== undefined ? `${queryParameter.defaultValue}` : '';

      input.addEventListener( 'input', () => {
        this.valueProperty.value = input.value.length ? input.value : undefined;
      } );

      this.addChild( new VBox( {
        align: 'left',
        spacing: 3,
        children: [
          nameInfoNode,
          new DOM( input, {
            allowInput: true,
            layoutOptions: {
              leftMargin: 20
            }
          } )
        ]
      } ) );
    }

    this.addChild( new UIRichText( queryParameter.doc.split( '\n' ).map( line => line.trim() ).join( ' ' ), {
      lineWrap: 500, // TODO: we need to adjust to take up the remaining space
      font: queryParameterDocFont,
      layoutOptions: {
        leftMargin: 20
      }
    } ) );

    // TODO: more disposal

    this.addDisposable( this.valueProperty );

    // Mutate our reference object on changes (... potentially remove a lot of logic above if we can simplify)
    this.valueProperty.lazyLink( value => {
      if ( this.queryParameter.type === 'flag' ) {
        if ( this.valueProperty.value ) {
          object[ this.queryParameter.name ] = undefined;
        }
        else {
          delete object[ this.queryParameter.name ];
        }
      }
      else if ( this.valueProperty.value !== undefined ) {
        object[ this.queryParameter.name ] = this.valueProperty.value; // just direct entry works for now
      }
      else {
        delete object[ this.queryParameter.name ];
      }
    } );
  }
}

export class QueryParametersNode extends UIAccordionBox {
  private object: Record<string, unknown> = {};

  public constructor(
    // TODO: remove unused?
    public readonly repoListEntry: RepoListEntry,
    public readonly branchInfo: BranchInfo,
    initialObject: Record<string, unknown>,
    public readonly queryParametersPromise: Promise<QueryParameter[]>,
    viewContext: ViewContext
  ) {
    const queryParameterContainer = new VBox( {
      align: 'left',
      spacing: 20,
      stretch: true
    } );

    super( queryParameterContainer, {
      titleNode: new UIText( 'Query Parameters' ),
      expandedDefaultValue: true
    } );

    // Copy, so we can mutate it and hold it as state
    this.object = {
      ...initialObject
    };

    const waitingNode = new WaitingNode( viewContext );

    // Work around a complicated disposal thing with AccordionBox layout
    this.disposeEmitter.addListener( () => {
      queryParameterContainer.children = [];
    } );

    this.addDisposable( waitingNode );

    queryParameterContainer.children = [
      new HBox( {
        spacing: 10,
        children: [
          new UIText( 'Loading query parameters...' ),
          waitingNode
        ]
      } ),
      ...Object.keys( this.object ).map( key => {
        return new PlaceholderQueryParameterNode( key, this.object[ key ] );
      } )
    ];

    queryParametersPromise.then( async queryParameters => {

      // Don't synchronously do this! --- now should be fine because it is faster
      // await clientSleep( 15 );

      if ( this.isDisposed ) {
        return;
      }

      const querySearchTextProperty = new StringProperty( '' );
      const searchBoxNode = new SearchBoxNode( querySearchTextProperty );
      const showAllProperty = new BooleanProperty( false );

      const searchTextThreshold = 2;

      Multilink.multilink( [ querySearchTextProperty, showAllProperty ], ( searchText, showAll ) => {

        let queryParameterNodes: QueryParameterNode[] = [];
        if ( searchText.length >= searchTextThreshold ) {

          const searchResults = fuzzysort.go<QueryParameter>( searchText, queryParameters, { key: 'name' } );

          queryParameterNodes = searchResults.map( result => {
            const queryParameter = result.obj;

            return new QueryParameterNode(
              queryParameter,
              result.highlight ? result.highlight.bind( result ) : ( () => queryParameter.name ),
              this.object,
              this.object[ queryParameter.name ],
              viewContext
            );
          } );
        }
        else {
          const filteredQueryParameters = showAll ? queryParameters : queryParameters.filter( queryParameter => {
            if ( favoriteQueryParametersProperty.value.includes( queryParameter.name ) ) {
              return true;
            }

            // Include sim-specific query parameters by default
            if ( ![
              'chipper',
              'phet-io',
              'scenery',
              'scenery-phet',
              'utterance-queue'
            ].includes( queryParameter.repo ) ) {
              return true;
            }

            if ( this.object.hasOwnProperty( queryParameter.name ) ) {
              return true;
            }

            return false;
          } );

          queryParameterNodes = filteredQueryParameters.map( queryParameter => {
            return new QueryParameterNode(
              queryParameter,
              ( () => queryParameter.name ),
              this.object,
              this.object[ queryParameter.name ],
              viewContext
            );
          } );
        }

        // TODO: order query parameters better (featured or non-default first)
        // TODO: include "unknown" parameters from defaultObject

        queryParameterContainer.children = [
          searchBoxNode,
          new UITextSwitch( showAllProperty, 'Show All Query Parameters', {
            visibleProperty: new DerivedProperty( [ querySearchTextProperty ], searchText => searchText.length < searchTextThreshold )
          } ),
          ...queryParameterNodes
        ];

        this.disposeEmitter.addListener( () => {
          queryParameterContainer.children = [];
        } );

        queryParameterNodes.forEach( node => this.addDisposable( node ) );
      } );
    } ).catch( e => { throw e; } );
  }

  public getQueryParameterObject(): Record<string, unknown> {
    return this.object;
  }
}