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
import { queryParameterDocFont } from '../theme.js';
import { UIAccordionBox } from '../UIAccordionBox.js';
import { ViewContext } from '../ViewContext.js';
import { WaitingNode } from '../WaitingNode.js';
import { clientSleep } from '../clientSleep.js';
import { DOM, HBox, Node, VBox } from 'scenerystack/scenery';
import { BooleanProperty, Property } from 'scenerystack/axon';
import { getInputCSSProperty } from '../css.js';

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
    public readonly hasDefaultObjectValue: boolean,
    public readonly defaultValue: unknown
  ) {
    super( {
      align: 'left',
      spacing: 3,
      stretch: true
    } );

    this.valueProperty = new Property( queryParameter.type === 'flag' ? hasDefaultObjectValue : defaultValue );

    const nameInfoNode = new UIRichText( `${queryParameter.name} <translucent>(${queryParameter.repo} ${queryParameter.type}${
      queryParameter.private ? ' private' : ''
    }${
      queryParameter.public ? ' public' : ''
    })</translucent>`, {
      tags: {
        // TODO: better alignment and such
        translucent: node => {
          return new Node( {
            children: [ node ],
            scale: 0.7,
            opacity: 0.6
          } );
        }
      }
    } );

    // NOTE: we could create subclasses for each type
    if ( queryParameter.type === 'flag' ) {
      this.addChild( new UISwitch( this.valueProperty as Property<boolean>, queryParameter.name, nameInfoNode ) );
    }
    else if ( queryParameter.type === 'boolean' && typeof queryParameter.defaultValue === 'boolean' ) {
      const isTrueProperty = new BooleanProperty( hasDefaultObjectValue ? defaultValue as boolean : queryParameter.defaultValue );

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
  }

  public writeIntoObject( obj: Record<string, unknown> ): void {
    if ( this.queryParameter.type === 'flag' ) {
      if ( this.valueProperty.value ) {
        obj[ this.queryParameter.name ] = undefined;
      }
      else {
        delete obj[ this.queryParameter.name ];
      }
    }
    else if ( this.valueProperty.value !== undefined ) {
      obj[ this.queryParameter.name ] = this.valueProperty.value; // just direct entry works for now
    }
    else {
      delete obj[ this.queryParameter.name ];
    }
  }
}

export class QueryParametersNode extends UIAccordionBox {
  private queryParameterNodes: QueryParameterNode[] = [];

  public constructor(
    public readonly repoListEntry: RepoListEntry,
    public readonly branchInfo: BranchInfo,
    public readonly defaultObject: Record<string, unknown>,
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

    const waitingNode = new WaitingNode( viewContext );

    this.addDisposable( waitingNode );

    queryParameterContainer.children = [
      new HBox( {
        spacing: 10,
        children: [
          new UIText( 'Loading query parameters...' ),
          waitingNode
        ]
      } ),
      ...Object.keys( this.defaultObject ).map( key => {
        return new PlaceholderQueryParameterNode( key, this.defaultObject[ key ] );
      } )
    ];

    queryParametersPromise.then( async queryParameters => {
      // Don't synchronously do this!
      await clientSleep( 15 );

      // TODO: order query parameters better (featured or non-default first)
      // TODO: include "unknown" parameters from defaultObject
      this.queryParameterNodes = queryParameters.map( queryParameter => {
        const hasDefaultObjectValue = Object.hasOwn( this.defaultObject, queryParameter.name );
        return new QueryParameterNode( queryParameter, hasDefaultObjectValue, this.defaultObject[ queryParameter.name ] );
      } );
      queryParameterContainer.children = this.queryParameterNodes;
    } ).catch( e => { throw e; } );
  }

  public getQueryParameterObject(): Record<string, unknown> {
    const object = {
      ...this.defaultObject
    };

    for ( const queryParameterNode of this.queryParameterNodes ) {
      queryParameterNode.writeIntoObject( object );
    }

    return object;
  }
}