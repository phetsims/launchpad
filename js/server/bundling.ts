// Copyright 2025, University of Colorado Boulder

/**
 * TODO: doc https://github.com/phetsims/phettest/issues/20
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import fsPromises from 'fs/promises'; // eslint-disable-line phet/default-import-match-filename
import esbuild from 'esbuild';
import os from 'os';
import { ROOT_DIR } from './options.js';

// --- esbuild Plugins (Hacks) ---
const simLauncherRewrite: esbuild.Plugin = {
  name: 'simLauncher-rewrite',
  setup( build ) {
    build.onLoad( { filter: /simLauncher.ts$/ }, async ( { path } ) => {
      let text = await fsPromises.readFile( path, 'utf8' );
      text = text.replace( '\'js\'', '\'ts\'' );
      return { contents: text, loader: 'ts' };
    } );
  }
};

const himalayaRewrite: esbuild.Plugin = {
  name: 'himalaya-rewrite',
  setup( build ) {
    build.onLoad( { filter: /himalaya-1.1.0.js$/ }, async ( { path } ) => {
      const originalText = await fsPromises.readFile( path, 'utf8' );
      const text = originalText.replace(
        '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.himalaya = f()}})',
        '( function( f ) {self.himalaya = f();})'
      );
      if ( text === originalText ) {
        throw new Error( 'himalaya rewrite failed?' );
      }
      return { contents: text, loader: 'js' };
    } );
  }
};

const peggyRewrite: esbuild.Plugin = {
  name: 'peggy-rewrite',
  setup( build ) {
    build.onLoad( { filter: /peggy-3.0.2.js$/ }, async ( { path } ) => {
      let text = await fsPromises.readFile( path, 'utf8' );
      text = text.replace(
        'function(e,u){"object"==typeof exports&&"undefined"!=typeof module?module.exports=u():"function"==typeof define&&define.amd?define(u):(e="undefined"!=typeof globalThis?globalThis:e||self).peggy=u()}'.replaceAll( '\n', os.EOL ),
        '( function( e,u ) {self.peggy = u();})'
      );
      return { contents: text, loader: 'js' };
    } );
  }
};

// Bundles a TS (or JS) entry point using esbuild, throws an error on failure.
export const bundleFile = async ( filePath: string, originalPathname: string ): Promise<string> => {
  try {
    const result = await esbuild.build( {
      entryPoints: [ filePath ],
      bundle: true,
      format: 'esm',
      minify: true,
      write: false, // We handle writing/sending the response
      sourcemap: 'inline', // Keep source maps inline for dev
      plugins: [ simLauncherRewrite, himalayaRewrite, peggyRewrite ],
      absWorkingDir: ROOT_DIR // Needed to resolve files relative to the entry point's directory
    } );
    const output = result.outputFiles[ 0 ];

    return output.text;
  }
  catch( err: unknown ) {
    console.error( 'Esbuild bundling error:', err );
    throw err;
  }
};

// Transpiles a single TS file in-memory, throws an error on failure.
export const transpileTS = async ( tsCode: string, filePath: string, originalPathname: string ): Promise<string> => {
  try {
    const loader = filePath.endsWith( 'tsx' ) ? 'tsx' :
                   filePath.endsWith( 'jsx' ) ? 'jsx' :
                   'ts';
    const result = await esbuild.transform( tsCode, {
      loader: loader,
      format: 'esm', // Output ESM
      sourcemap: 'inline', // Keep source maps inline for dev
      target: 'esnext' // Use modern JS features
    } );

    return result.code;
  }
  catch( err: unknown ) {
    console.error( 'Esbuild transform error:', err );
    throw err;
  }
};
