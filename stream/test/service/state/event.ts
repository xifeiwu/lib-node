import {Duplex, Readable, Writable} from 'stream';
import {logColorful} from '../../../../log';
import {WatchStreamOptions} from './types';
import {ReadableEvent} from '../../../../types';
import {isNumber} from '../../../../external';
import {largeDataToString} from '../../../../transform';
import {printDuplexState, printReadableState, printWritableState} from './state';

export function watchReadableState(reader: Readable, options?: WatchStreamOptions) {
  const {color, logPrefix = '', maxPrintSizeOnData, printState, isDuplex} = options ?? {};
  const role = isDuplex ? 'duplex' : 'reader';
  const printStateFunc = (isDuplex ? printDuplexState : printReadableState) as typeof printReadableState;
  if (printState) {
    logColorful({color}, `${logPrefix}${role} state:`);
    printStateFunc(reader);
  }
  /**
   * Event readable, data will change flowMode of Readable, so it will not in event list by default.
   * NOTICE: data, readable can not be listened together.
   */
  const eventNameList: ReadableEvent[] = ['pause', 'resume', 'end', 'error', 'close'];
  // as listen on data event will change flowingMode of readable, so I should be set explictly by caller
  if (isNumber(maxPrintSizeOnData)) {
    reader.on('data', chunk => {
      const {byteLength} = chunk;
      logColorful(
        {color},
        `${logPrefix} ${role} on-${'data'} [size: ${byteLength}]: ${largeDataToString(chunk, {
          maxPrintSize: maxPrintSizeOnData,
        })}`
      );
      printState && printStateFunc(reader);
    });
  }
  for (const eventName of eventNameList) {
    reader.on(eventName, chunkOrError => {
      logColorful({color}, `${logPrefix} ${role} on-${eventName}`);
      if (eventName === 'error') {
        logColorful({color}, chunkOrError.stack);
      }
      printState && printStateFunc(reader);
    });
  }
}

export function watchWritableState(writer: Writable, options?: WatchStreamOptions) {
  const {color, logPrefix = '', printState, isDuplex} = options ?? {};
  const role = isDuplex ? 'duplex' : 'writer';
  const printStateFunc = (isDuplex ? printDuplexState : printWritableState) as typeof printWritableState;
  if (printState) {
    logColorful({color}, `${logPrefix} ${role} state:`);
    printStateFunc(writer);
  }
  const eventNameList = ['drain', 'finish', 'pipe', 'unpipe', 'error', 'close'];
  for (const eventName of eventNameList) {
    writer.on(eventName, chunkOrError => {
      logColorful({color}, `${logPrefix} ${role} on-${eventName}`);
      if (eventName === 'error') {
        logColorful({color}, chunkOrError.stack);
      }
      printState && printStateFunc(writer);
    });
  }
}

interface watchOptions extends WatchStreamOptions {
  reader?: WatchStreamOptions;
  writer?: WatchStreamOptions;
}
export function watchDuplexState(duplex: Duplex, watchOptions?: watchOptions) {
  const {reader = {}, writer = {}, ...rest} = watchOptions ?? {};
  watchReadableState(duplex, {...rest, ...reader, isDuplex: true});
  watchWritableState(duplex, {...rest, ...writer, isDuplex: true});
}
