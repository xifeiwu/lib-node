import assert from 'assert';
import {Writable, Transform, PassThrough} from 'stream';
import {logColorful} from '../../../log';
import {getCustomizedReader, getCustomizedWriter, getCustomizedDuplex, getCustomizedTransform} from './index';

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

export async function testGetCustomizedReader() {
  logColorful({color: 'yellow'}, '--- reader with default generateCount (3) ---');
  {
    const reader = getCustomizedReader({source: 'abc', chunkSize: 1});
    const chunks = await collectReadable(reader);
    assert.equal(chunks.length, 3);
    logColorful(
      {},
      'chunks:',
      chunks.map(c => c.toString())
    );
  }

  logColorful({color: 'yellow'}, '--- reader with custom generateCount ---');
  {
    const reader = getCustomizedReader({source: 'hello', chunkSize: 2, generateCount: 5});
    const chunks = await collectReadable(reader);
    assert.equal(chunks.length, 5);
    for (const chunk of chunks) {
      assert.equal(chunk.byteLength, 2);
    }
    logColorful(
      {},
      'chunks:',
      chunks.map(c => c.toString())
    );
  }

  logColorful({color: 'yellow'}, '--- reader with color logging ---');
  {
    const reader = getCustomizedReader({
      source: 'xy',
      chunkSize: 1,
      generateCount: 2,
      color: 'cyan',
      logPrefix: 'test-reader',
    });
    const chunks = await collectReadable(reader);
    assert.equal(chunks.length, 2);
  }
}

export async function testGetCustomizedReaderWithDelay() {
  const start = Date.now();
  const reader = getCustomizedReader({
    source: 'abc',
    chunkSize: 1,
    generateCount: 3,
    delay: 50,
  });
  const chunks = await collectReadable(reader);
  const elapsed = Date.now() - start;
  assert.equal(chunks.length, 3);
  assert(elapsed >= 100, `expected >= 100ms with 3 chunks * 50ms delay, got ${elapsed}ms`);
  logColorful({}, `delay test: ${chunks.length} chunks in ${elapsed}ms`);
}

export async function testGetCustomizedWriter() {
  logColorful({color: 'yellow'}, '--- writer receives piped data ---');
  {
    const receivedChunks: string[] = [];
    const writer = getCustomizedWriter({color: 'green', logPrefix: 'test-writer'});
    const originalWrite = writer._write.bind(writer);
    writer._write = function (chunk, enc, cb) {
      receivedChunks.push(chunk.toString());
      originalWrite(chunk, enc, cb);
    };

    const reader = getCustomizedReader({source: 'abc', chunkSize: 1, generateCount: 3});
    reader.pipe(writer);
    await waitForFinish(writer);
    assert.equal(receivedChunks.length, 3);
    logColorful({}, 'received:', receivedChunks);
  }

  logColorful({color: 'yellow'}, '--- writer with delay ---');
  {
    const start = Date.now();
    const writer = getCustomizedWriter({delay: 50});
    const reader = getCustomizedReader({source: 'x', chunkSize: 1, generateCount: 3});
    reader.pipe(writer);
    await waitForFinish(writer);
    const elapsed = Date.now() - start;
    assert(elapsed >= 100, `expected >= 100ms with 3 writes * 50ms delay, got ${elapsed}ms`);
    logColorful({}, `writer delay test: ${elapsed}ms`);
  }
}

export async function testGetCustomizedDuplex() {
  logColorful({color: 'yellow'}, '--- duplex with read config ---');
  {
    const duplex = getCustomizedDuplex({
      customize: {
        read: {source: 'abc', chunkSize: 1, generateCount: 3},
        color: 'blue',
        logPrefix: 'test-duplex',
      },
    });
    const chunks = await collectReadable(duplex);
    assert.equal(chunks.length, 3);
    logColorful(
      {},
      'duplex read:',
      chunks.map(c => c.toString())
    );
  }

  logColorful({color: 'yellow'}, '--- duplex with read + write config ---');
  {
    const duplex = getCustomizedDuplex({
      customize: {
        read: {source: 'xy', chunkSize: 1, generateCount: 2},
        write: {},
        color: 'magenta',
      },
    });
    const chunks = await collectReadable(duplex);
    assert.equal(chunks.length, 2);
  }

  logColorful({color: 'yellow'}, '--- duplex without customize (no-op read) ---');
  {
    const duplex = getCustomizedDuplex();
    duplex.push(Buffer.from('manual'));
    duplex.push(null);
    const chunks = await collectReadable(duplex);
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].toString(), 'manual');
  }
}

export async function testGetCustomizedTransform() {
  logColorful({color: 'yellow'}, '--- transform with custom transform function ---');
  {
    const transform = getCustomizedTransform({
      customize: {
        color: 'green',
        logPrefix: 'test-transform',
      },
      transform(chunk, _enc, cb) {
        cb(null, Buffer.from(chunk.toString().toUpperCase()));
      },
    });
    const reader = getCustomizedReader({source: 'abc', chunkSize: 1, generateCount: 3});
    const passThrough = new PassThrough();
    reader.pipe(transform).pipe(passThrough);
    const chunks = await collectReadable(passThrough);
    assert.equal(chunks.length, 3);
    const results = chunks.map(c => c.toString());
    logColorful({}, 'transformed:', results);
    assert.deepEqual(results, ['A', 'B', 'C']);
  }

  logColorful({color: 'yellow'}, '--- transform with read config ---');
  {
    const transform = getCustomizedTransform({
      customize: {
        read: {source: 'xy', chunkSize: 1, generateCount: 2},
        color: 'cyan',
        logPrefix: 'transform-read',
      },
      transform(chunk, _enc, cb) {
        cb(null, chunk);
      },
    });
    const chunks = await collectReadable(transform);
    assert.equal(chunks.length, 2);
    logColorful(
      {},
      'transform with read:',
      chunks.map(c => c.toString())
    );
  }
}
