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
import { getLastNotableEvents, logEvents } from './client-api.js';
import { LocalStorageBooleanProperty } from './localStorage.js';
import { UITextCheckbox } from './UITextCheckbox.js';
import { WaitingNode } from './WaitingNode.js';

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

  private onShowEmitter = new TinyEmitter();

  public constructor( viewContext: ViewContext ) {
    const gridBoxOptions = {
      ySpacing: 3,
      xSpacing: 20,
      xAlign: 'left'
    } as const;

    const logGridBox = new GridBox( gridBoxOptions );

    const logLevels = [ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ].reverse();

    const logLevelProperties: Record<string, Property<boolean>> = {};
    for ( const level of logLevels ) {
      logLevelProperties[ level ] = new LocalStorageBooleanProperty( `logLevel-${level}`, true );
    }

    const errorsContainer = new VBox( {
      spacing: 10,
      align: 'left'
    } );
    const warningsContainer = new VBox( {
      spacing: 10,
      align: 'left'
    } );

    const errorsGridBox = new GridBox( gridBoxOptions );
    const warningsGridBox = new GridBox( gridBoxOptions );

    super( new VBox( {
      spacing: 40,
      align: 'left',
      children: [
        new UIText( 'Server Log', { font: uiHeaderFont } ),
        errorsContainer,
        warningsContainer,
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

    const logEventToGridRow = ( logEvent: LogEvent ) => {
      return [
        new UIText( logEvent.timestamp ),
        new UIText( logEvent.level ),
        new RichText( logEvent.message, {
          font: uiFont,
          fill: uiForegroundColorProperty,
          replaceNewlines: true
        } )
      ];
    };

    const updateLogGrid = () => {
      logGridBox.rows = recordedLogEvents.filter( logEvent => {
        return logLevelProperties[ logEvent.level ].value;
      } ).slice( -NUM_LOG_LINES ).map( logEvent => {
        return logEventToGridRow( logEvent );
      } );
    };
    updateLogGrid();

    logEventEmitter.addListener( ( logEvent: LogEvent ) => {
      updateLogGrid();
    } );

    for ( const level of logLevels ) {
      logLevelProperties[ level ].lazyLink( updateLogGrid );
    }

    const errorWaitingNode = new WaitingNode( viewContext );
    const warningWaitingNode = new WaitingNode( viewContext );

    this.onShowEmitter.addListener( async () => {
      errorsContainer.children = [ errorWaitingNode ];
      warningsContainer.children = [ warningWaitingNode ];

      const lastNotableEvents = await getLastNotableEvents();

      if ( lastNotableEvents.lastErrorLogEvents.length ) {
        errorsGridBox.rows = lastNotableEvents.lastErrorLogEvents.slice( -10 ).map( logEventToGridRow );
        errorsContainer.children = [
          new UIText( 'Recent Errors:', { font: uiHeaderFont } ),
          errorsGridBox
        ];
      }
      else {
        errorsContainer.children = [];
      }

      if ( lastNotableEvents.lastWarnLogEvents.length ) {
        warningsGridBox.rows = lastNotableEvents.lastWarnLogEvents.slice( -10 ).map( logEventToGridRow );
        warningsContainer.children = [
          new UIText( 'Recent Warnings:', { font: uiHeaderFont } ),
          warningsGridBox
        ];
      }
      else {
        warningsContainer.children = [];
      }
    } );
  }

  public override show(): void {
    super.show();

    this.onShowEmitter.emit();
  }
}
