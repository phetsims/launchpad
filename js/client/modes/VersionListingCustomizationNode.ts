// Copyright 2025, University of Colorado Boulder

/**
 * Customization for versions
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { Repo } from '../../types/common-types.js';
import { HBox, Node } from 'scenerystack/scenery';
import { WaitingNode } from '../WaitingNode.js';
import { ViewContext } from '../ViewContext.js';
import { UIText } from '../UIText.js';
import { DatedVersion, getDevVersions, getProductionVersions } from '../fileListings.js';
import { UIAquaRadioButtonGroup } from '../UIAquaRadioButtonGroup.js';
import { Property } from 'scenerystack/axon';
import moment from 'moment';

export class VersionListingCustomizationNode extends Node {

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

export class ProductionCustomizationNode extends VersionListingCustomizationNode {
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

export class DevCustomizationNode extends VersionListingCustomizationNode {
  public constructor( repo: Repo, viewContext: ViewContext ) {
    super(
      repo,
      getDevVersions( repo ),
      // NOTE: We can't get much better than the directory listing, unless we check the SHAs for the version to detect
      // the directory/file shapes
      version => version === 'base' ? `https://phet-dev.colorado.edu/html/${repo}/` : `https://phet-dev.colorado.edu/html/${repo}/${version}/`,
      'base',
      '(root directory)',
      viewContext
    );
  }
}