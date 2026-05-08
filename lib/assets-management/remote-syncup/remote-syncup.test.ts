import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import {initSampleAssets, removeDataDir} from '../file-generator';
import {handleAssetsSyncConnection} from './server';
import {
  ASSETS_SYNC_PROTOCOL_BYTE,
  writeJsonFrame,
  streamFileToSocket,
  readJsonFrame,
  type DiffMessage,
  type SuccessMessage,
  type ChatMessage,
} from './protocol';
import {getFileMetaHandler} from '../service/file-meta-handler';
import {serailizeAssetInfo} from '../service/asset-info';
import {alignMetaWithAssets} from '../operation';

const CLIENT_DIR = '/tmp/assets-sync-test-client';
const SERVER_DIR = '/tmp/assets-sync-test-server';

function startServer(dir: string): Promise<{server: net.Server; port: number}> {
  return new Promise((resolve, reject) => {
    const server = net.createServer(socket => {
      handleAssetsSyncConnection(socket, {dir});
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      resolve({server, port});
    });
  });
}

function connectClient(port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => resolve(socket));
    socket.on('error', reject);
  });
}

export async function testPushFlow() {
  await initSampleAssets(CLIENT_DIR);
  removeDataDir({rootDir: SERVER_DIR});

  const getMetaHandlers = getFileMetaHandler();
  const clientHandlers = await getMetaHandlers(CLIENT_DIR);
  await alignMetaWithAssets(clientHandlers);
  const clientMeta = await clientHandlers.getMeta();

  const {server, port} = await startServer(SERVER_DIR);

  try {
    const socket = await connectClient(port);

    socket.write(Buffer.from([ASSETS_SYNC_PROTOCOL_BYTE]));
    await writeJsonFrame(socket, {
      command: 'push',
      meta: {
        rootDir: CLIENT_DIR,
        assetInfoList: clientMeta.assetInfoList.map(it => serailizeAssetInfo(it) as any),
      },
    });

    const diffMsg = await readJsonFrame<DiffMessage>(socket);
    console.log('label:', diffMsg.label);
    console.log('added:', diffMsg.meta.added?.length ?? 0);

    const {added = [], modified = []} = diffMsg.meta;
    const filesToSend = [...added.map(a => a.relativePath), ...modified.map(m => m.to.relativePath)];

    for (const relativePath of filesToSend) {
      const filePath = path.join(CLIENT_DIR, relativePath);
      const stat = fs.statSync(filePath);
      await writeJsonFrame(socket, {label: 'add-file', meta: {relativePath, size: stat.size}});
      await streamFileToSocket(filePath, socket);
    }
    await writeJsonFrame(socket, {label: 'transfer-complete'});

    let result: SuccessMessage;
    while (true) {
      const frame = await readJsonFrame<ChatMessage>(socket);
      if (frame.label === 'info') {
        console.log('[info]', frame.meta.message);
      } else {
        result = frame as SuccessMessage;
        break;
      }
    }
    console.log('result:', result.label, JSON.stringify(result.meta));

    socket.end();
  } finally {
    server.close();
    removeDataDir({rootDir: CLIENT_DIR});
    removeDataDir({rootDir: SERVER_DIR});
  }
}
