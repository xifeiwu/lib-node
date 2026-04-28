import {Duplex, Readable, Writable} from 'stream';
import {logColorful} from '../../../log';
import {WatchStreamOptions} from './types';
import {ReadableEvent} from '../../../types';
import {isNumber} from '../../../external';
import {largeDataToString} from '../../../transform';
import {printDuplexState, printReadableState, printWritableState} from './state';

function formatLogMessage(parts: Array<string | null | undefined>) {
  return '[' + parts.filter(Boolean).join(' ') + ']';
}

function logIfColor(color: WatchStreamOptions['color'], message: string) {
  if (color !== undefined) {
    logColorful({color}, message);
  }
}

function traceEvent(eventTrace: WatchStreamOptions['eventTrace'], eventName: string) {
  if (Array.isArray(eventTrace)) {
    eventTrace.push(eventName);
  }
}

export function watchReadableState(reader: Readable, options?: WatchStreamOptions) {
  const {color, logPrefix = '', maxPrintSizeOnData, printState, isDuplex, eventTrace} = options ?? {};
  const role = isDuplex ? 'duplex' : 'reader';
  const printStateFunc = (isDuplex ? printDuplexState : printReadableState) as typeof printReadableState;
  const log = (...parts: Array<string | null | undefined>) => logIfColor(color, formatLogMessage(parts));
  const print = () => printState && printStateFunc(reader);

  if (printState) {
    log(logPrefix, role, 'state:');
    printStateFunc(reader);
  }
  /**
   * Event readable, data will change flowMode of Readable, so it will not in event list by default.
   * NOTICE: data, readable can not be listened together.
   */
  const eventNameList: ReadableEvent[] = ['pause', 'resume', 'end', 'error', 'close'];
  if (isNumber(maxPrintSizeOnData)) {
    reader.on('data', chunk => {
      traceEvent(eventTrace, 'data');
      const {byteLength} = chunk;
      log(
        logPrefix ? `[${logPrefix}]` : null,
        `[${role}]`,
        '[on-data]',
        `[size: ${byteLength}]:`,
        largeDataToString(chunk, {
          maxPrintSize: maxPrintSizeOnData,
        })
      );
      print();
    });
  }
  for (const eventName of eventNameList) {
    reader.on(eventName, chunkOrError => {
      traceEvent(eventTrace, eventName);
      log(logPrefix, role, `on-${eventName}`);
      if (eventName === 'error') {
        logIfColor(color, chunkOrError.stack);
      }
      print();
    });
  }
}

export function watchWritableState(writer: Writable, options?: WatchStreamOptions) {
  const {color, logPrefix = '', printState, isDuplex, eventTrace} = options ?? {};
  const role = isDuplex ? 'duplex' : 'writer';
  const printStateFunc = (isDuplex ? printDuplexState : printWritableState) as typeof printWritableState;
  const log = (...parts: Array<string | null | undefined>) => logIfColor(color, formatLogMessage(parts));
  const print = () => printState && printStateFunc(writer);

  if (printState) {
    log(logPrefix, role, 'state:');
    printStateFunc(writer);
  }
  const eventNameList = ['drain', 'finish', 'pipe', 'unpipe', 'error', 'close'];
  for (const eventName of eventNameList) {
    writer.on(eventName, chunkOrError => {
      traceEvent(eventTrace, eventName);
      log(logPrefix, role, `on-${eventName}`);
      if (eventName === 'error') {
        logIfColor(color, chunkOrError.stack);
      }
      print();
    });
  }
}

interface WatchOptions extends WatchStreamOptions {
  reader?: WatchStreamOptions;
  writer?: WatchStreamOptions;
}
export function watchDuplexState(duplex: Duplex, watchOptions?: WatchOptions) {
  const {reader = {}, writer = {}, ...rest} = watchOptions ?? {};
  watchReadableState(duplex, {...rest, ...reader, isDuplex: true});
  watchWritableState(duplex, {...rest, ...writer, isDuplex: true});
}
