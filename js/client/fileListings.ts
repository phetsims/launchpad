// Copyright 2025, University of Colorado Boulder

/**
 * File listings from production/dev (for various versions)
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { SimVersion } from 'scenerystack/perennial';
import { Repo } from '../types/common-types.js';

export type DatedVersion = {
  simVersion: SimVersion;
  date: Date;
};

export const getProductionVersions = async ( repo: Repo ): Promise<DatedVersion[]> => {
  return getVersionListing( `https://phet.colorado.edu/sims/html/${repo}/` );
};

export const getDevVersions = async ( repo: Repo ): Promise<DatedVersion[]> => {
  return getVersionListing( `https://phet-dev.colorado.edu/html/${repo}/` );
};

export const getVersionListing = async ( url: string ): Promise<DatedVersion[]> => {
  const response = await fetch( url );

  if ( !response.ok ) {
    throw new Error( `Failed to fetch production versions for ${url}: ${response.status} ${response.statusText}` );
  }

  const text = await response.text();

  const doc = new DOMParser().parseFromString( text, 'text/html' );

  const trs = Array.from( doc.querySelector( 'table' )!.tBodies[ 0 ].childNodes ).filter( node => ( node as Element ).tagName === 'TR' );

  const results: DatedVersion[] = [];

  for ( const tr of trs ) {
    if ( !tr.childNodes[ 1 ] || !tr.childNodes[ 2 ] ) {
      continue;
    }

    const versionString = tr.childNodes[ 1 ].textContent!.replace( /\//g, '' ).trim();
    const date = new Date( tr.childNodes[ 2 ].textContent!.trim() );

    try {
      const simVersion = SimVersion.parse( versionString );

      results.push( {
        simVersion: simVersion,
        date: date
      } );
    }
    catch( e ) {
      // ignore invalid versions
    }
  }

  return results;
};