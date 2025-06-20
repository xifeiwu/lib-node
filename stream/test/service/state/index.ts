import {Duplex, Readable, Writable} from 'stream';
import {logColorful} from '../../../../log';
import {WatchStreamOptions} from './types';
import {ReadableEvent} from '../../../../types';
import {isNumber} from '../../../../external';
import {largeDataToString} from '../../../../transform';

export function printReadableState(reader: Readable) {
  const {closed, destroyed, readable, readableFlowing, readableHighWaterMark, readableLength} = reader;
  logColorful(
    {},
    {
      closed,
      destroyed,
      readable,
      readableFlowing,
      readableHighWaterMark,
      readableLength,
      paused: reader.isPaused(),
    }
  );
}
export function watchReadableState(reader: Readable, options?: WatchStreamOptions) {
  const {colorStyle = {color: 'black'}, logPrefix = '', maxPrintSizeOnData = 16, printState} = options ?? {};
  if (printState) {
    logColorful(colorStyle, `${logPrefix}reader state:`);
    printReadableState(reader);
  }
  /**
   * Event readable, data will change flowMode of Readable, so it will not in event list by default.
   * NOTICE: data, readable can not be listened together.
   */
  const eventNameList: ReadableEvent[] = ['pause', 'resume', 'end', 'error', 'close'];
  if (isNumber(maxPrintSizeOnData)) {
    reader.on('data', chunk => {
      const {byteLength} = chunk;
      logColorful(colorStyle, `${logPrefix}reader on-${'data'} [size: ${byteLength}]`);
      // console.log(chunk.toString());
      logColorful(colorStyle, largeDataToString(chunk, {maxPrintSize: maxPrintSizeOnData}));
      printState && printReadableState(reader);
    });
  }
  for (const eventName of eventNameList) {
    reader.on(eventName, chunkOrError => {
      logColorful(colorStyle, `${logPrefix}reader on-${eventName}`);
      if (eventName === 'error') {
        logColorful(colorStyle, chunkOrError.stack);
      }
      printState && printReadableState(reader);
    });
  }
}

export function printWritableState(writer: Writable) {
  const {closed, destroyed, writable, writableCorked, writableEnded, writableLength} = writer;
  logColorful({}, {closed, destroyed, writable, writableCorked, writableEnded, writableLength});
}

export function watchWritableState(writer: Writable, options?: WatchStreamOptions) {
  const {colorStyle = {color: 'black'}, logPrefix = '', printState} = options ?? {};
  if (printState) {
    logColorful(colorStyle, `${logPrefix}writer state:`);
    printWritableState(writer);
  }
  const eventNameList = ['drain', 'finish', 'pipe', 'unpipe', 'error', 'close'];
  for (const eventName of eventNameList) {
    writer.on(eventName, chunkOrError => {
      logColorful(colorStyle, `${logPrefix}writer on-${eventName}`);
      if (eventName === 'error') {
        colorStyle && logColorful(colorStyle, chunkOrError.stack);
      }
      printState && printWritableState(writer);
    });
  }
}

export function watchDuplexState(duplex: Duplex, options?: WatchStreamOptions) {
  watchReadableState(duplex, options);
  watchWritableState(duplex, options);
}
