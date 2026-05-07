import {Socket} from 'net';
import fs from 'fs';
import path from 'path';

export const ASSETS_SYNC_PROTOCOL_BYTE = 0x10;

export type AssetsSyncCommand = 'push' | 'pull' | 'diff';

export function readExactly(socket: Socket, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let received = 0;

    const cleanup = () => {
      socket.removeListener('readable', onReadable);
      socket.removeListener('error', onError);
      socket.removeListener('end', onEnd);
    };

    const onReadable = () => {
      while (received < n) {
        const remaining = n - received;
        const chunk = socket.read(Math.min(remaining, socket.readableLength || remaining));
        if (chunk === null) break;
        chunks.push(chunk);
        received += chunk.length;
      }
      if (received >= n) {
        cleanup();
        resolve(Buffer.concat(chunks, n));
      }
    };

    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };

    const onEnd = () => {
      cleanup();
      if (received >= n) {
        resolve(Buffer.concat(chunks, n));
      } else {
        reject(new Error(`Connection ended before reading ${n} bytes (got ${received})`));
      }
    };

    socket.on('readable', onReadable);
    socket.on('error', onError);
    socket.on('end', onEnd);
    onReadable();
  });
}

export async function readFrame(socket: Socket): Promise<Buffer> {
  const header = await readExactly(socket, 4);
  const length = header.readUInt32BE(0);
  if (length === 0) return Buffer.alloc(0);
  return readExactly(socket, length);
}

export function writeFrame(socket: Socket, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const header = Buffer.alloc(4);
    header.writeUInt32BE(data.length, 0);
    socket.write(header, err => {
      if (err) return reject(err);
      if (data.length === 0) return resolve();
      socket.write(data, err2 => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

export async function readJsonFrame<T = any>(socket: Socket): Promise<T> {
  const buf = await readFrame(socket);
  return JSON.parse(buf.toString('utf8'));
}

export async function writeJsonFrame(socket: Socket, obj: any): Promise<void> {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  return writeFrame(socket, buf);
}

export function streamFileToSocket(filePath: string, socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(filePath);
    rs.on('error', reject);
    rs.on('end', resolve);
    rs.pipe(socket, {end: false});
  });
}

export async function writeFileFrame(socket: Socket, filePath: string, size: number): Promise<void> {
  const header = Buffer.alloc(4);
  header.writeUInt32BE(size, 0);
  await new Promise<void>((resolve, reject) => {
    socket.write(header, err => (err ? reject(err) : resolve()));
  });
  await streamFileToSocket(filePath, socket);
}

export function receiveFileFromSocket(socket: Socket, filePath: string, size: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {recursive: true});
    }
    const ws = fs.createWriteStream(filePath);
    let received = 0;

    const cleanup = () => {
      socket.removeListener('readable', onReadable);
      socket.removeListener('error', onError);
      socket.removeListener('end', onEnd);
    };

    const onReadable = () => {
      while (received < size) {
        const remaining = size - received;
        const chunk = socket.read(Math.min(remaining, socket.readableLength || remaining));
        if (chunk === null) break;
        ws.write(chunk);
        received += chunk.length;
      }
      if (received >= size) {
        cleanup();
        ws.end(() => resolve());
      }
    };

    const onError = (err: Error) => {
      cleanup();
      ws.destroy();
      reject(err);
    };

    const onEnd = () => {
      cleanup();
      ws.end();
      if (received >= size) {
        resolve();
      } else {
        reject(new Error(`Connection ended before receiving file (got ${received}/${size})`));
      }
    };

    socket.on('readable', onReadable);
    socket.on('error', onError);
    socket.on('end', onEnd);
    onReadable();
  });
}
