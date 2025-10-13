// Copyright 2025, University of Colorado Boulder

/**
 * Copies a string to the clipboard.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

export const copyToClipboard = async ( str: string ): Promise<void> => {
  await navigator.clipboard?.writeText( str );
};