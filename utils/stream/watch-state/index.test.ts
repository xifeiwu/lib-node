import assert from 'assert';
import {Duplex, PassThrough, Readable, Writable} from 'stream';
import {logColorful} from '../../../log';
import {watchReadableState, watchWritableState, watchDuplexState} from './event';
import {printReadableState, printWritableState, printDuplexState} from './state';
import {getCustomizedReader, getCustomizedWriter, getCustomizedDuplex} from '../generator';

function collectReadable(reader: NodeJS.ReadableStream): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    reader.on('data', chunk => chunks.push(chunk));
    reader.on('end', () => resolve(chunks));
    reader.on('error', reject);
  });
}

function waitForFinish(writer: NodeJS.WritableStream): Promise<void> {
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

export async function testWatchReadableState() {
  logColorful({color: 'yellow'}, '--- watchReadableState: basic event logging ---');
  {
    const reader = getCustomizedReader({source: 'abc', chunkSize: 1, generateCount: 3});
    watchReadableState(reader, {
      color: 'cyan',
      logPrefix: 'watch-test',
      printState: true,
      maxPrintSizeOnData: 8,
    });
    const chunks = await collectReadable(reader);
    assert.equal(chunks.length, 3);
    logColorful({}, 'watchReadable test passed, got', chunks.length, 'chunks');
  }

  logColorful({color: 'yellow'}, '--- watchReadableState: without data listener ---');
  {
    const reader = getCustomizedReader({source: 'xy', chunkSize: 1, generateCount: 2});
    watchReadableState(reader, {color: 'green', printState: true});
    const chunks = await collectReadable(reader);
    assert.equal(chunks.length, 2);
  }
}

export async function testWatchWritableState() {
  logColorful({color: 'yellow'}, '--- watchWritableState: finish and close events ---');
  {
    const reader = getCustomizedReader({source: 'abc', chunkSize: 1, generateCount: 3});
    const writer = getCustomizedWriter();
    watchWritableState(writer, {
      color: 'magenta',
      logPrefix: 'watch-writer',
      printState: true,
    });
    reader.pipe(writer);
    await waitForFinish(writer);
    logColorful({}, 'watchWritable test passed');
  }
}

export async function testWatchDuplexState() {
  logColorful({color: 'yellow'}, '--- watchDuplexState: both sides ---');
  {
    const duplex = getCustomizedDuplex({
      customize: {
        read: {source: 'abc', chunkSize: 1, generateCount: 3},
        color: 'blue',
      },
    });
    watchDuplexState(duplex, {
      color: 'yellow',
      logPrefix: 'watch-duplex',
      reader: {printState: true, maxPrintSizeOnData: 8},
      writer: {printState: true},
    });
    const chunks = await collectReadable(duplex);
    assert.equal(chunks.length, 3);
    logColorful({}, 'watchDuplex test passed, got', chunks.length, 'chunks');
  }
}

export async function testPrintReadableState() {
  logColorful({color: 'yellow'}, '--- printReadableState ---');
  const reader = new Readable({read() {}});
  printReadableState(reader);
  reader.push(Buffer.from('test'));
  printReadableState(reader);
  reader.push(null);
  await collectReadable(reader);
  printReadableState(reader);
  logColorful({}, 'printReadableState test passed');
}

export async function testPrintWritableState() {
  logColorful({color: 'yellow'}, '--- printWritableState ---');
  const writer = new Writable({
    write(_chunk, _enc, cb) {
      cb();
    },
  });
  printWritableState(writer);
  writer.write(Buffer.from('test'));
  printWritableState(writer);
  writer.end();
  await waitForFinish(writer);
  printWritableState(writer);
  logColorful({}, 'printWritableState test passed');
}

export async function testPrintDuplexState() {
  logColorful({color: 'yellow'}, '--- printDuplexState ---');
  const duplex = new PassThrough();
  printDuplexState(duplex);
  duplex.write(Buffer.from('test'));
  printDuplexState(duplex);
  duplex.end();
  await waitForFinish(duplex);
  printDuplexState(duplex);
  logColorful({}, 'printDuplexState test passed');
}
