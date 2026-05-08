import * as net from 'net';
import * as fs from 'fs';
import {initSampleAssets, removeDataDir} from '../file-generator';
import {handleAssetsSyncConnection} from './server';
import {runAssetsSyncCommand} from './client';
import {getFileList} from '../external';

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

export async function testPushFlow() {
  await initSampleAssets(CLIENT_DIR);
  removeDataDir({rootDir: SERVER_DIR});

  const {server, port} = await startServer(SERVER_DIR);
  try {
    const diff = await runAssetsSyncCommand('diff', CLIENT_DIR, {host: '127.0.0.1', port: String(port)});
    console.log('diff', diff);
    await runAssetsSyncCommand('push', CLIENT_DIR, {host: '127.0.0.1', port: String(port)});
    const fileList = getFileList(SERVER_DIR);
    console.log('fileList', fileList);
  } finally {
    server.close();
    removeDataDir({rootDir: CLIENT_DIR});
    removeDataDir({rootDir: SERVER_DIR});
  }
}

export async function testPullFlow() {
  await initSampleAssets(SERVER_DIR);
  removeDataDir({rootDir: CLIENT_DIR});
  fs.mkdirSync(CLIENT_DIR, {recursive: true});

  const {server, port} = await startServer(SERVER_DIR);
  try {
    await runAssetsSyncCommand('pull', CLIENT_DIR, {host: '127.0.0.1', port: String(port)});
  } finally {
    server.close();
    removeDataDir({rootDir: CLIENT_DIR});
    removeDataDir({rootDir: SERVER_DIR});
  }
}
