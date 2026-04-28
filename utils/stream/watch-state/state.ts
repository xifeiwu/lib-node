import {Duplex, Readable, Writable} from 'stream';
import {logColorful} from '../../../log';

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
export function printWritableState(writer: Writable) {
  const {
    closed,
    destroyed,
    writable,
    writableCorked,
    writableEnded,
    writableFinished,
    writableHighWaterMark,
    writableLength,
  } = writer;
  logColorful(
    {},
    {
      closed,
      destroyed,
      writable,
      writableCorked,
      writableEnded,
      writableFinished,
      writableHighWaterMark,
      writableLength,
    }
  );
}

export function printDuplexState(duplex: Duplex) {
  const {
    allowHalfOpen,
    closed,
    destroyed,
    readable,
    readableFlowing,
    readableHighWaterMark,
    readableLength,
    writable,
    writableCorked,
    writableEnded,
    writableFinished,
    writableHighWaterMark,
    writableLength,
  } = duplex;
  logColorful(
    {},
    {
      allowHalfOpen,
      closed,
      destroyed,
      readable,
      readableFlowing,
      readableHighWaterMark,
      readableLength,
      writable,
      writableCorked,
      writableEnded,
      writableFinished,
      writableHighWaterMark,
      writableLength,
    }
  );
}
