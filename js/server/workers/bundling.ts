// Copyright 2025, University of Colorado Boulder

/**
 * Bundling and Transpiling using esbuild.
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import Piscina from 'piscina';
import fsPromises from 'fs/promises'; // eslint-disable-line phet/default-import-match-filename
import esbuild from 'esbuild';
import os from 'os';
import path from 'path';
import { getModulifiedFile } from './modulifyAPI.js';

const ROOT_DIR: string = Piscina.workerData.ROOT_DIR;

const extensionToLoader: Partial<Record<string, string>> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
  '.json': 'json',
  '.mjs': 'js',
  '.cjs': 'js',
  '.css': 'css',
  '.txt': 'text'
};

const getEsbuildLoadPlugin = ( modulify: boolean ): esbuild.Plugin => {
  return {
    name: 'simLauncher-rewrite',
    setup( build ) {
      build.onLoad( { filter: /.*/ }, async onLoadArgs => {
        const absolutePath = onLoadArgs.path;
        const relativePath = path.relative( ROOT_DIR, absolutePath );

        const contentPromise = fsPromises.readFile( absolutePath, 'utf8' );

        if ( relativePath === 'joist/js/simLauncher.ts' ) {
          // console.log( 'custom', relativePath );
          return {
            contents: ( await contentPromise ).replace( '\'js\'', '\'ts\'' ),
            loader: 'ts'
          };
        }
        else if ( relativePath.endsWith( 'himalaya-1.1.0.js' ) ) {
          const originalText = await contentPromise;
          const text = originalText.replace(
            '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.himalaya = f()}})',
            '( function( f ) {self.himalaya = f();})'
          );
          if ( text === originalText ) {
            throw new Error( 'himalaya rewrite failed?' );
          }
          // console.log( 'custom', relativePath );
          return { contents: text, loader: 'js' };
        }
        else if ( relativePath.endsWith( 'peggy-3.0.2.js' ) ) {
          let text = await contentPromise;
          text = text.replace(
            'function(e,u){"object"==typeof exports&&"undefined"!=typeof module?module.exports=u():"function"==typeof define&&define.amd?define(u):(e="undefined"!=typeof globalThis?globalThis:e||self).peggy=u()}'.replaceAll( '\n', os.EOL ),
            '( function( e,u ) {self.peggy = u();})'
          );
          // console.log( 'custom', relativePath );
          return { contents: text, loader: 'js' };
        }
        else {
          const modulifyResponse = modulify ? await getModulifiedFile(
            relativePath,

            // These will be lazily filled in if necessary
            null,
            null
          ) : null;

          const extension = path.extname( relativePath );
          const loader = extensionToLoader[ extension ];

          if ( modulifyResponse && modulifyResponse.modulified ) {
            // console.log( 'modulified', relativePath );

            return {
              contents: modulifyResponse.fileContents,
              loader: loader as esbuild.Loader
            };
          }
          else {
            if ( loader ) {
              // console.log( 'loaded', relativePath );
              return {
                contents: await contentPromise,
                loader: loader as esbuild.Loader
              };
            }
            else {
              // console.log( 'passthrough', relativePath );
              // pass through
              return null;
            }
          }
        }
      } );
    }
  };
};

const nonModulifyPlugin = getEsbuildLoadPlugin( false );
const modulifyPlugin = getEsbuildLoadPlugin( true );

// Bundles a TS (or JS) entry point using esbuild, throws an error on failure.
export const bundleFile = async (
  rootDir: string,
  filePath: string,
  modulify: boolean
): Promise<string> => {
  const result = await esbuild.build( {
    entryPoints: [ filePath ],
    bundle: true,
    format: 'esm',
    // minify: true, TODO: consider better minification? https://github.com/phetsims/phettest/issues/20
    minifyWhitespace: true,
    minifySyntax: true,
    write: false, // We handle writing/sending the response
    sourcemap: 'inline', // Keep source maps inline for dev
    plugins: [ modulify ? modulifyPlugin : nonModulifyPlugin ],
    absWorkingDir: rootDir // Needed to resolve files relative to the entry point's directory
  } );
  const output = result.outputFiles[ 0 ];

  return `// Bundled by launchpad at ${new Date().toISOString()} from ${filePath} with modulify: ${modulify}\n${output.text}`;
};

// Transpiles a single TS file in-memory, throws an error on failure.
export const transpileTS = async ( tsCode: string, filePath: string ): Promise<string> => {
  const loader = filePath.endsWith( 'tsx' ) ? 'tsx' :
                 filePath.endsWith( 'jsx' ) ? 'jsx' :
                 'ts';
  const result = await esbuild.transform( tsCode, {
    loader: loader,
    format: 'esm', // Output ESM
    sourcemap: 'inline', // Keep source maps inline for dev
    target: 'esnext' // Use modern JS features
  } );

  return `// Transpiled by launchpad at ${new Date().toISOString()} from ${filePath}\n${result.code}`;
};
