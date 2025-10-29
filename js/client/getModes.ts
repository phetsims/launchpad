// Copyright 2025, University of Colorado Boulder

/**
 * Returns the given modes and UIs
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { BranchInfo, QueryParameter, Repo, RepoListEntry } from '../types/common-types.js';
import { HBox, Node, VBox } from 'scenerystack/scenery';
import { WaitingNode } from './WaitingNode.js';
import { ViewContext } from './ViewContext.js';
import { UIText } from './UIText.js';
import { DatedVersion, getDevVersions, getProductionVersions } from './fileListings.js';
import { UIAquaRadioButtonGroup } from './UIAquaRadioButtonGroup.js';
import { BooleanProperty, Property } from 'scenerystack/axon';
import moment from 'moment';
import { showAdvancedProperty, useBuiltProperty } from './settings.js';
import { UITextSwitch } from './UITextSwitch.js';
import { getWrappers } from './client-api.js';
import { queryParameterDocFont, uiHeaderFont } from './theme.js';
import { UIRichText } from './UIRichText.js';
import { UISwitch } from './UISwitch.js';

export type CustomizationNode = Node & { getURL: () => string };

export type ModeData = {
  name: string;
  description: string;
  createCustomizationNode: () => CustomizationNode;
};

class EmptyCustomizationNode extends Node {
  public constructor(
    public url: string
  ) {
    super();
  }

  public getURL(): string {
    return this.url;
  }
}

class SimpleUnbuiltBuiltCustomizationNode extends VBox {
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

class VersionListingCustomizationNode extends Node {

  private readonly versionProperty!: Property<string>;

  public constructor(
    public readonly repo: Repo,
    datedVersionsPromise: Promise<DatedVersion[]>,
    private versionStringToURL: ( versionString: string ) => string,
    defaultName: string,
    defaultLabel: string,
    viewContext: ViewContext
  ) {
    super();

    this.versionProperty = new Property( defaultName );

    const waitingNode = new WaitingNode( viewContext );

    this.addDisposable( waitingNode );

    this.children = [
      new HBox( {
        spacing: 10,
        children: [
          new UIText( 'Loading versions...' ),
          waitingNode
        ]
      } )
    ];

    ( async () => {
      const datedVersions = await datedVersionsPromise;

      datedVersions.sort( ( a, b ) => -a.simVersion.compareNumber( b.simVersion ) );

      this.children = [
        new UIAquaRadioButtonGroup( this.versionProperty, [
          {
            value: defaultName,
            createNode: () => new UIText( defaultLabel )
          },
          ...datedVersions.map( datedVersion => {
            return {
              value: datedVersion.simVersion.toString(),
              createNode: () => new UIText( `${datedVersion.simVersion.toString()} (${moment( datedVersion.date ).calendar()})` )
            };
          } )
        ] )
      ];
    } )().catch( e => { throw e; } );
  }

  public getURL(): string {
    return this.versionStringToURL( this.versionProperty.value );
  }
}

class ProductionCustomizationNode extends VersionListingCustomizationNode {
  public constructor( repo: Repo, viewContext: ViewContext ) {
    super(
      repo,
      getProductionVersions( repo ),
      version => `https://phet.colorado.edu/sims/html/${repo}/${version}/${repo}_all.html`,
      'latest',
      'latest',
      viewContext
    );
  }
}

class DevCustomizationNode extends VersionListingCustomizationNode {
  public constructor( repo: Repo, viewContext: ViewContext ) {
    super(
      repo,
      getDevVersions( repo ),
      // TODO: Better URL for launching? or just better to show that directory?
      version => version === 'base' ? `https://phet-dev.colorado.edu/html/${repo}/` : `https://phet-dev.colorado.edu/html/${repo}/${version}/`,
      'base',
      '(root directory)',
      viewContext
    );
  }
}

class WrappersNode extends Node {
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

    // TODO: overrides!!!! (because we can compute things based on packageJSON, etc.)

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

    // TODO: we could create subclasses for each type
    if ( queryParameter.type === 'flag' ) {
      this.addChild( new UISwitch( this.valueProperty as Property<boolean>, queryParameter.name, nameInfoNode ) );
    }
    else if ( queryParameter.type === 'boolean' && typeof queryParameter.defaultValue === 'boolean' ) {
      const isTrueProperty = new BooleanProperty( hasDefaultObjectValue ? defaultValue as boolean : queryParameter.defaultValue );

      this.addChild( new UISwitch( isTrueProperty, queryParameter.name, nameInfoNode, {
        // TODO: consider color reversal
        // reversedColors: !!queryParameter.defaultValue
      } ) );

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
              createNode: () => new UIText( `${value}${queryParameter.name === 'locale' ? ` (${phet.chipper.localeData[ value ].englishName})` : ''}` )
            };
          } ), { layoutOptions: { leftMargin: 20 } } )
        ]
      } ) );
    }
    else {
      this.addChild( nameInfoNode );
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
      // TODO: anything else besides just.... direct entry?
      obj[ this.queryParameter.name ] = this.valueProperty.value;
    }
    else {
      delete obj[ this.queryParameter.name ];
    }
  }
}

class QueryParametersNode extends VBox {
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

    super( {
      align: 'left',
      spacing: 15,
      children: [
        // TODO: accordion box?
        new UIText( 'Query Parameters' ),
        queryParameterContainer
      ]
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

    queryParametersPromise.then( queryParameters => {
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

export const getModes = (
  repoListEntry: RepoListEntry,
  branchInfo: BranchInfo,
  queryParametersPromise: Promise<QueryParameter[]>,
  viewContext: ViewContext
): ModeData[] => {

  const repo = branchInfo.repo;
  const owner = repoListEntry.owner;

  const modes: ModeData[] = [];

  // const versionString = branchInfo.version || '';

  const isRunnable = repoListEntry.isRunnable;
  const isCheckedOut = branchInfo.isCheckedOut;
  const isMainBranch = branchInfo.branch === 'main';
  const hasBuild = branchInfo.lastBuiltTime !== null;
  const hasUnitTests = repoListEntry.hasUnitTests;
  const supportsPhet = branchInfo.brands.includes( 'phet' );
  const supportsPhetio = branchInfo.brands.includes( 'phet-io' );
  const supportsInteractiveDescription = repoListEntry.supportsInteractiveDescription;
  const showAdvanced = showAdvancedProperty.value;

  const releaseBranchPrefix = branchInfo.branch === 'main' ? '' : `release-branches/${branchInfo.repo}-${branchInfo.branch}/`;
  const repoDirectory = `${releaseBranchPrefix}${repo}`;

  const phetioStandaloneQueryParameters = branchInfo.usesOldPhetioStandalone ? 'phet-io.standalone' : 'phetioStandalone';
  const proxiesParams = branchInfo.usesRelativeSimPath ? 'relativeSimPath' : 'launchLocalVersion';
  const studioName = supportsPhetio && branchInfo.usesPhetioStudio ? 'studio' : 'instance-proxies';
  const studioNameBeautified = studioName === 'studio' ? 'Studio' : 'Instance Proxies';
  const usesChipper2 = branchInfo.isChipper2;
  const phetFolder = usesChipper2 ? '/phet' : '';
  const phetioFolder = usesChipper2 ? '/phet-io' : '';
  const phetSuffix = usesChipper2 ? '_phet' : '';
  const phetioSuffix = usesChipper2 ? '_all_phet-io' : '_en-phetio';
  // const phetioBrandSuffix = usesChipper2 ? '' : '-phetio';
  const studioPathSuffix = branchInfo.usesPhetioStudioIndex ? '/' : `/${studioName}.html?sim=${branchInfo.repo}&${proxiesParams}`;
  // const phetioDevVersion = usesChipper2 ? versionString : versionString.split( '-' ).join( '-phetio' );

  const simSpecificWrappers: string[] = supportsPhetio ? ( branchInfo.phetPackageJSON?.[ 'phet-io' ]?.wrappers ?? [] ) : [];

  const nonStudioQueryParametersPromise = queryParametersPromise.then( queryParameters => {
    return queryParameters.filter( queryParameter => queryParameter.repo !== 'studio' );
  } );

  // `](https://phet-dev.colorado.edu/html/${this.repo}/${versionString}${phetFolder}/${this.repo}_all${phetSuffix}.html)`

  // TODO: locale-specific versions perhaps? https://github.com/phetsims/phettest/issues/20
  isRunnable && isCheckedOut && supportsPhet && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'phet',
    description: 'Runs the PhET-brand simulation',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${repoDirectory}/${repo}_en.html` : null,
        hasBuild ? `${repoDirectory}/build${phetFolder}/${repo}_all${phetSuffix}.html` : null,
        nonStudioQueryParametersPromise,
        viewContext,
        {
          ea: undefined,
          brand: 'phet',
          debugger: undefined
        },
        {}
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'phet-io',
    description: 'Runs the simulation in phet-io standalone mode',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${repoDirectory}/${repo}_en.html?ea&brand=phet-io&${phetioStandaloneQueryParameters}&debugger` : null,
        hasBuild ? `${repoDirectory}/build${phetioFolder}/${repo}${phetioSuffix}.html?${phetioStandaloneQueryParameters}` : null,
        nonStudioQueryParametersPromise,
        viewContext,

        // TODO: phetioStandaloneQueryParameters and such
        {},
        {}
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'studio',
    description: `Runs the simulation in ${studioNameBeautified}`,
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        // TODO: likely this URL won't work for older cases https://github.com/phetsims/phettest/issues/20
        isMainBranch ? `${releaseBranchPrefix}studio/?sim=${repo}&phetioWrapperDebug=true&phetioElementsDisplay=all` : null,
        hasBuild ? `${repoDirectory}/build${phetioFolder}/wrappers/${studioName}${studioPathSuffix}` : null,
        queryParametersPromise,
        viewContext
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'index',
    description: 'Runs the phet-io wrapper index',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${releaseBranchPrefix}phet-io-wrappers/index/?sim=${repo}&phetioDebug=true&phetioWrapperDebug=true` : null,
        hasBuild ? `${repoDirectory}/build${phetioFolder}/` : null,
        nonStudioQueryParametersPromise,
        viewContext
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && isMainBranch && modes.push( {
    name: 'wrappers',
    description: 'Runs phet-io wrappers',
    createCustomizationNode: () => {
      return new WrappersNode(
        repo,
        simSpecificWrappers,
        releaseBranchPrefix,
        // TODO: will need to put other things in here to determine the URLs to use (also ... support built forms)
        viewContext
      );
    }
  } );

  isRunnable && isCheckedOut && supportsPhetio && isMainBranch && showAdvanced && modes.push( {
    name: 'wrapper unit tests',
    description: 'Runs the phet-io wrapper unit tests',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phet-io-wrappers/phet-io-wrappers-tests.html?sim=${repo}` );
    }
  } );

  isRunnable && isCheckedOut && supportsInteractiveDescription && ( isMainBranch || hasBuild ) && modes.push( {
    name: 'a11y view',
    description: 'Runs the simulation in an iframe next to a copy of the PDOM to easily inspect accessible content',
    createCustomizationNode: () => {
      return new SimpleUnbuiltBuiltCustomizationNode(
        repoListEntry,
        branchInfo,
        isMainBranch ? `${releaseBranchPrefix}chipper/wrappers/a11y-view/?sim=${repo}&brand=phet&ea&debugger` : null,
        hasBuild ? `${repoDirectory}/build${phetFolder}/${repo}_a11y_view.html` : null,
        nonStudioQueryParametersPromise,
        viewContext
      );
    }
  } );

  isRunnable && isCheckedOut && hasBuild && modes.push( {
    name: 'xhtml',
    description: 'Runs the built simulation XHTML',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/build${phetFolder}/xhtml/${repo}_all.xhtml` );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'color editor',
    description: 'Runs the top-level -colors.html file (allows editing/viewing different profile colors)',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phetmarks/color-editor.html?sim=${repo}` );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'production',
    description: 'Runs production versions (defaults to the latest)',
    createCustomizationNode: () => {
      return new ProductionCustomizationNode( repo, viewContext );
    }
  } );

  isRunnable && isMainBranch && modes.push( {
    name: 'dev (bayes)',
    description: 'Loads the location on phet-dev.colorado.edu with versions for each dev deploy',
    createCustomizationNode: () => {
      return new DevCustomizationNode( repo, viewContext );
    }
  } );

  // repo === 'phet-io' && modes.push( {
  //   name: 'fuzz-test studio wrapper',
  //   description: 'Runs automated testing with fuzzing on studio, 15 second timer',
  //   createCustomizationNode: () => {
  //     return new EmptyCustomizationNode( `../aqua/fuzz-lightyear/?fuzz&wrapperName=studio&wrapperContinuousTest=%7B%7D&repos=${TODO phetio sims joined by comma}` );
  //   }
  // } );
  // repo === 'phet-io' && modes.push( {
  //   name: 'test-migration-sims',
  //   text: 'Fuzz Test Migration',
  //   description: 'Runs automated testing with fuzzing on studio, 10 second timer',
  //   url: '../aqua/fuzz-lightyear/',
  //   queryParameters: getFuzzLightyearParameters( 20000 ).concat( migrationQueryParameters ).concat( [ {
  //     value: 'fuzz&wrapperName=migration&wrapperContinuousTest=%7B%7D&migrationRate=2000&' +
  //            `phetioMigrationReport=assert&repos=${phetioHydrogenSims.map( simData => simData.sim ).join( ',' )}`,
  //     text: 'Fuzz Test PhET-IO sims',
  //     default: true
  //   } ] )
  // } );
  // repo === 'phet-io' && modes.push( {
  //   name: 'test-state-sims',
  //   text: 'Fuzz Test State Wrapper',
  //   description: 'Runs automated testing with fuzzing on state, 15 second timer',
  //   url: '../aqua/fuzz-lightyear/',
  //   queryParameters: getFuzzLightyearParameters( 15000 ).concat( [ {
  //     value: `fuzz&wrapperName=state&setStateRate=3000&wrapperContinuousTest=%7B%7D&repos=${phetioSims.join( ',' )}`,
  //     text: 'Fuzz Test PhET-IO sims',
  //     default: true
  //   } ] )
  // } );

  repo === 'phet-io-website' && modes.push( {
    name: 'view local',
    description: 'view the local root of the website',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${releaseBranchPrefix}phet-io-website/root/` );
    }
  } );

  hasUnitTests && modes.push( {
    name: 'unit tests (unbuilt)',
    description: 'Runs unit tests in unbuilt mode',
    createCustomizationNode: () => {
      // TODO: provide phet-io brand if phet-io/tandem/phet-io-wrappers?
      return new EmptyCustomizationNode( `${repoDirectory}/${repo}-tests.html` );
    }
  } );

  [ 'phet-io', 'binder' ].includes( repo ) && modes.push( {
    name: 'documentation',
    description: 'Browse HTML documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/doc${repo === 'binder' ? 's' : ''}/` );
    }
  } );

  repo === 'scenery' && modes.push( {
    name: 'basics documentation',
    description: 'Scenery Basics Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-basics/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'layout documentation',
    description: 'Scenery Layout Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-layout/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'input documentation',
    description: 'Scenery Input Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-input/' );
    }
  } );
  repo === 'scenery' && modes.push( {
    name: 'accessibility documentation',
    description: 'Scenery Accessibility Documentation',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://scenerystack.org/learn/scenery-accessibility/' );
    }
  } );

  ( repo === 'scenery' || repo === 'kite' || repo === 'dot' || repo === 'phet-core' || repo === 'alpenglow' ) && modes.push( {
    name: 'playground',
    description: `Loads ${repo} and dependencies in the tab, and allows quick testing`,
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/tests/playground.html` );
    }
  } );

  repo === 'scenery' && modes.push( {
    name: 'sandbox',
    description: 'Allows quick testing of Scenery features',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `${repoDirectory}/tests/sandbox.html` );
    }
  } );

  repo === 'yotta' && modes.push( {
    name: 'statistics page',
    description: 'Goes to the yotta report page, credentials in the Google Doc',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( 'https://bayes.colorado.edu/statistics/yotta/' );
    }
  } );
  repo === 'skiffle' && modes.push( {
    name: 'sound board',
    description: 'Interactive HTML page for exploring existing sounds in sims and common code',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( '../skiffle/html/sound-board.html' );
    }
  } );
  repo === 'quake' && modes.push( {
    name: 'haptics playground (build for browser)',
    description: 'Built browser version of the Haptics Playground app',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( '../quake/platforms/browser/www/haptics-playground.html' );
    }
  } );

  // TODO: start from --- if ( repo === 'chipper' || repo === 'aqua' ) {

  modes.push( {
    name: 'github',
    description: 'Opens to the repository\'s GitHub main page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}` );
    }
  } );

  modes.push( {
    name: 'issues',
    description: 'Opens to the repository\'s GitHub issues page',
    createCustomizationNode: () => {
      return new EmptyCustomizationNode( `https://github.com/${owner}/${repo}/issues` );
    }
  } );

  return modes;
};

/**
 * From the wrapper path in perennial-alias/data/wrappers, get the name of the wrapper.
 */
export const getWrapperName = ( wrapper: string ): string => {

  // If the wrapper has its own individual repo, then get the name 'classroom-activity' from 'phet-io-wrapper-classroom-activity'
  // Maintain compatibility for wrappers in 'phet-io-wrappers-'
  const wrapperParts = wrapper.split( 'phet-io-wrapper-' );
  const wrapperName = wrapperParts.length > 1 ?
                      wrapperParts[ 1 ] :
                      wrapper.startsWith( 'phet-io-sim-specific' ) ? wrapper.split( '/' )[ wrapper.split( '/' ).length - 1 ]
                                                                   : wrapper;

  // If the wrapper still has slashes in it, then it looks like 'phet-io-wrappers/active'
  const splitOnSlash = wrapperName.split( '/' );
  return splitOnSlash[ splitOnSlash.length - 1 ];
};