// Copyright 2025, University of Colorado Boulder

/**
 * Extraction of query parameters from JS/TS code in repos
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import os from 'os';
import ts from 'typescript';
// eslint-disable-next-line phet/default-import-match-filename
import fsPromises from 'fs/promises';
import { QueryParameter, QueryParameterType, Repo } from '../types/common-types.js';
import { logger } from './logging.js';
// eslint-disable-next-line phet/default-import-match-filename
import executeImport from '../../../perennial/js/common/execute.js';

const execute = executeImport.default;

export const kindOf = ( node: ts.Node ): string => ts.SyntaxKind[ node.kind ];

export const getLeadingComments = ( sourceCode: string, node: ts.Node ): string[] => {
  const comments = ts.getLeadingCommentRanges( sourceCode, node.pos );

  return comments ? comments.map( comment => sourceCode.slice( comment.pos, comment.end ) ) : [];
};

export const deslashLineComment = ( string: string ): string => {
  return string.replace( /^\/\/ ?/, '' );
};

export const destarBlockComment = ( string: string ) => {
  return string.split( os.EOL ).filter( line => {
    const isCommentStart = line.match( /^ *\/\*+ *$/g );
    const isCommentEnd = line.match( /^ *\*+\/ *$/g );
    return !isCommentStart && !isCommentEnd;
  } ).map( line => {
    let destarred = line.replace( /^ *\* ?/, '' );

    // If the line is effectively empty (composed of only spaces), set it to the empty string.
    if ( destarred.replace( / /g, '' ).length === 0 ) {
      destarred = '';
    }
    return destarred;
  } ).join( os.EOL );
};

export const cleanupComment = ( string: string ) => {
  if ( string.startsWith( '/*' ) ) {
    return destarBlockComment( string );
  }
  else if ( string.startsWith( '//' ) ) {
    return deslashLineComment( string );
  }
  else {
    return string;
  }
};

export const logIndent = ( node: ts.Node, indentLevel: number ): void => {
  console.log( '  '.repeat( indentLevel ) + kindOf( node ) );
  node.getChildren().forEach( child => logIndent( child, indentLevel + 1 ) );
};

export const extractQueryParameters = async ( repo: Repo, directory: string ): Promise<QueryParameter[]> => {
  const queryParameters: QueryParameter[] = [];

  // Some repos we will just abort out, because they have many places
  if ( [ 'aqua', 'interaction-dashboard', 'phet-io-wrappers' ].includes( repo ) ) {
    return [];
  }

  const potentialFiles = ( await execute( 'grep', [ '-Rsl', 'QueryStringMachine.getAll(', 'js' ], directory, {
    errors: 'resolve'
  } ) ).stdout.split( os.EOL ).map( line => line.trim() ).filter( line => line.length > 0 );

  for ( const file of potentialFiles ) {
    logger.debug( `Scanning ${directory}/${file} for query parameters` );

    const sourcePath = `${directory}/${file}`;
    const sourceCode = await fsPromises.readFile( sourcePath, 'utf-8' );

    const sourceAST = ts.createSourceFile(
      sourcePath,
      sourceCode,
      ts.ScriptTarget.ESNext,
      true
    );

    const mainChildren = sourceAST.getChildren()[ 0 ].getChildren();

    const topLevelAssign = mainChildren.find( node => {
      return ts.isVariableStatement( node ) &&
             node.declarationList.declarations[ 0 ].initializer &&
             ts.isCallExpression( node.declarationList.declarations[ 0 ].initializer ) &&
             node.declarationList.declarations[ 0 ].initializer.expression.getText() === 'QueryStringMachine.getAll' &&
             ts.isObjectLiteralExpression( node.declarationList.declarations[ 0 ].initializer.arguments[ 0 ] );
    } );

    let objectLiteral: ts.ObjectLiteralExpression;
    if ( topLevelAssign ) {
      objectLiteral = ( ( topLevelAssign as ts.VariableStatement ).declarationList.declarations[ 0 ].initializer as ts.CallExpression ).arguments[ 0 ] as ts.ObjectLiteralExpression;
    }
    else {
      const topExpression = mainChildren[ 0 ] as ts.ExpressionStatement;
      const topParenthesized = topExpression.expression as ts.ParenthesizedExpression;
      const topCall = topParenthesized.expression as ts.CallExpression;
      const topFunction = topCall.expression as ts.FunctionExpression;
      const topStatements = topFunction.body.statements;
      const topVariableStatements = topStatements.filter( node => ts.isVariableStatement( node ) );
      const topVariableDeclarations = topVariableStatements.flatMap( node => node.declarationList.declarations );
      const matchingDeclaration = topVariableDeclarations.find( declaration => {
        return ts.isIdentifier( declaration.name ) && declaration.name.text === 'QUERY_PARAMETERS_SCHEMA';
      } )!;
      objectLiteral = matchingDeclaration.initializer as ts.ObjectLiteralExpression;
    }

    const propertyAssignments = objectLiteral.properties.filter( node => ts.isPropertyAssignment( node ) );

    for ( const propertyAssignment of propertyAssignments ) {
      const name = ( propertyAssignment.name as ts.Identifier ).text;
      const doc = getLeadingComments( sourceCode, propertyAssignment ).map( cleanupComment ).join( os.EOL );

      // Handle things like getGameLevelsSchema
      if ( ts.isCallExpression( propertyAssignment.initializer ) ) {
        const expressionText = propertyAssignment.initializer.expression.getText();

        if ( expressionText === 'getGameLevelsSchema' ) {
          queryParameters.push( {
            name: name,
            doc: doc,
            type: 'array',
            public: true,
            elementSchema: { type: 'number' },
            repo: repo
          } );
          continue;
        }

        logger.warn( `Unhandled call expression for query param initializer: ${repo} ${name} ${expressionText}` );
        continue;
      }

      const subPropertyAssignments = ( propertyAssignment.initializer as ts.ObjectLiteralExpression ).properties.filter( node => ts.isPropertyAssignment( node ) );
      const typeAssignment = subPropertyAssignments.find( subPropertyAssignment => {
        const subName = ( subPropertyAssignment.name as ts.Identifier ).text;
        return subName === 'type';
      } )!;

      const type = ( typeAssignment.initializer as ts.StringLiteral ).text;

      const queryParameter: QueryParameter = {
        name: name,
        doc: doc,
        type: type as QueryParameterType,
        repo: repo
      };
      queryParameters.push( queryParameter );

      const expressionToValue = ( node: ts.Expression ): unknown => {
        const kind = kindOf( node );
        if ( kind === 'TrueKeyword' ) {
          return true;
        }
        else if ( kind === 'FalseKeyword' ) {
          return false;
        }
        else if ( kind === 'NullKeyword' ) {
          return null;
        }
        else if ( kind === 'StringLiteral' ) {
          return ( node as ts.StringLiteral ).text;
        }
        else if ( node.numericLiteralFlags !== undefined ) {
          return Number( ( node as ts.NumericLiteral ).text );
        }
        else if ( ts.isArrayLiteralExpression( node ) ) {
          return node.elements.map( element => expressionToValue( element ) );
        }
        else {
          logger.verbose( `Query param expression parse fail: ${repo} ${name} ${node.getText()}` );
          return undefined;
        }
      };

      for ( const subPropertyAssignment of subPropertyAssignments ) {
        const subName = ( subPropertyAssignment.name as ts.Identifier ).text;

        if ( subName === 'defaultValue' ) {
          const value = expressionToValue( subPropertyAssignment.initializer );
          if ( value !== undefined ) {
            queryParameter.defaultValue = value;
          }
        }
        if ( subName === 'validValues' ) {
          const value = expressionToValue( subPropertyAssignment.initializer );
          if ( value !== undefined ) {
            queryParameter.validValues = value as unknown[];
          }
        }
        if ( subName === 'public' ) {
          const value = expressionToValue( subPropertyAssignment.initializer );
          if ( value !== undefined ) {
            queryParameter.public = value as boolean;
          }
        }
        if ( subName === 'private' ) {
          const value = expressionToValue( subPropertyAssignment.initializer );
          if ( value !== undefined ) {
            queryParameter.private = value as boolean;
          }
        }
        if ( subName === 'separator' ) {
          const value = expressionToValue( subPropertyAssignment.initializer );
          if ( value !== undefined ) {
            queryParameter.separator = value as string;
          }
        }
      }
    }
  }

  queryParameters.sort( ( a, b ) => a.name.localeCompare( b.name ) );

  return queryParameters;
};