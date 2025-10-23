// Copyright 2025, University of Colorado Boulder

/**
 * Log node
 *
 * @author Jonathan Olson <jonathan.olson@colorado.edu>
 */

import { PopupNode } from './PopupNode.js';
import { UIText } from './UIText.js';
import { ViewContext } from './ViewContext.js';
import { GridBox, HBox, RichText, VBox } from 'scenerystack/scenery';
import { uiFont, uiForegroundColorProperty, uiHeaderFont } from './theme.js';
import { Property, TEmitter, TinyEmitter } from 'scenerystack/axon';
import { LogEvent } from '../types/common-types.js';
import { logEvents } from './client-api.js';
import { LocalStorageBooleanProperty } from './localStorage.js';
import { UITextCheckbox } from './UITextCheckbox.js';

let logEventEmitter: TEmitter<[LogEvent]> | null = null;
const recordedLogEvents: LogEvent[] = [];

export const getLogEventEmitter = (): TEmitter<[LogEvent]> => {
  if ( !logEventEmitter ) {
    logEventEmitter = new TinyEmitter<[LogEvent]>();

    ( async () => {
      try {
        await logEvents( logEvent => {
          recordedLogEvents.push( logEvent );
          logEventEmitter!.emit( logEvent );
        } );
      }
      catch( e ) {
        console.error( 'Error fetching log events:', e );
      }
    } )().catch( e => { throw e; } );
  }

  return logEventEmitter;
};

const NUM_LOG_LINES = 35;

export class LogNode extends PopupNode {
  public constructor( viewContext: ViewContext ) {
    const logGridBox = new GridBox( {
      ySpacing: 3,
      xSpacing: 20,
      xAlign: 'left'
    } );

    const logLevels = [ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ].reverse();

    const logLevelProperties: Record<string, Property<boolean>> = {};
    for ( const level of logLevels ) {
      logLevelProperties[ level ] = new LocalStorageBooleanProperty( `logLevel-${level}`, true );
    }

    super( new VBox( {
      spacing: 40,
      align: 'left',
      children: [
        new UIText( 'Server Log', { font: uiHeaderFont } ),
        new HBox( {
          spacing: 10,
          children: logLevels.map( level => {
            return new UITextCheckbox( level, logLevelProperties[ level ] );
          } )
        } ),
        logGridBox
      ]
    } ), viewContext );

    const logEventEmitter = getLogEventEmitter();

    const updateLogGrid = () => {
      logGridBox.rows = recordedLogEvents.filter( logEvent => {
        return logLevelProperties[ logEvent.level ].value;
      } ).slice( -NUM_LOG_LINES ).map( logEvent => {
        return [
          new UIText( logEvent.timestamp ),
          new UIText( logEvent.level ),
          new RichText( logEvent.message, {
            font: uiFont,
            fill: uiForegroundColorProperty,
            replaceNewlines: true
          } )
        ];
      } );
    };
    updateLogGrid();

    logEventEmitter.addListener( ( logEvent: LogEvent ) => {
      updateLogGrid();
    } );

    for ( const level of logLevels ) {
      logLevelProperties[ level ].lazyLink( updateLogGrid );
    }
  }
}
