import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import {getFileMetaHandler} from '../service/file-meta-handler';
import {serailizeAssetInfo} from '../service/asset-info';
import {getPartialAssetInfo} from '../service/asset-info';
import {byteToWord, goOnOrNot} from '../external';
import {printDiffSummary} from '../service/diff-print';
import type {AssetInfoFull, AssetListMeta, MetaDiffForSyncUp} from '../types';
import {
  ASSETS_SYNC_PROTOCOL_BYTE,
  readJsonFrame,
  writeJsonFrame,
  streamFileToSocket,
  receiveFileFromSocket,
} from './protocol';
import type {
  AssetsSyncCommand,
  AddFileMessage,
  DiffMessage,
  SuccessMessage,
  SimpleMessage,
  ChatMessage,
} from './types';
import {alignMetaWithAssets} from '../operation';

async function getLocalMeta(dir: string): Promise<AssetListMeta> {
  const absDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(absDir)) {
    throw new Error(`Directory does not exist: ${absDir}`);
  }
  const getMetaHandlers = getFileMetaHandler();
  const metaHandlers = await getMetaHandlers(absDir);
  await alignMetaWithAssets(metaHandlers);
  console.log(`Scanning local files in ${absDir}...`);
  const meta = await metaHandlers.getMeta();
  console.log(`Found ${meta.assetInfoList.length} files.`);
  return {
    rootDir: absDir,
    assetInfoList: meta.assetInfoList.map(it => serailizeAssetInfo(it) as any),
  };
}

function connectToServer(host: string, port: number): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, host, () => resolve(socket));
    socket.on('error', reject);
  });
}

export async function runAssetsSyncCommand(
  command: AssetsSyncCommand,
  dir: string,
  options: {host: string; port: string; runDirectly?: boolean}
) {
  const host = options.host;
  const port = parseInt(options.port, 10);
  const absDir = path.resolve(process.cwd(), dir);

  const meta = await getLocalMeta(dir);

  console.log(`Connecting to ${host}:${port}...`);
  const socket = await connectToServer(host, port);
  console.log('Connected.');

  socket.write(Buffer.from([ASSETS_SYNC_PROTOCOL_BYTE]));
  await writeJsonFrame(socket, {command, meta});

  const response = await readJsonFrame<DiffMessage>(socket);
  const diff = response.meta;
  printDiffSummary(diff);

  if (command === 'diff' || !diff.isNeedAction) {
    socket.end();
    return;
  }

  if (!options.runDirectly) {
    const shouldContinue = await goOnOrNot({
      tips: [`Run command ${command}?`],
      defaultValue: true,
    });
    if (!shouldContinue) {
      socket.end();
      return;
    }
  }

  if (command === 'push') {
    await handlePushClient(socket, diff, absDir);
  } else if (command === 'pull') {
    await handlePullClient(socket, diff, absDir);
  }
}

async function handlePushClient(socket: net.Socket, diff: MetaDiffForSyncUp, rootDir: string) {
  const {added = [], modified = []} = diff;

  const filesToSend: {relativePath: string}[] = [
    ...added.map(a => ({relativePath: a.relativePath})),
    ...modified.map(m => ({relativePath: m.to.relativePath})),
  ];

  let sent = 0;
  for (const {relativePath} of filesToSend) {
    const filePath = path.join(rootDir, relativePath);
    const stat = fs.statSync(filePath);
    await writeJsonFrame(socket, {label: 'add-file', meta: {relativePath, size: stat.size}});
    await streamFileToSocket(filePath, socket);
    sent++;
    console.log(`  [${sent}/${filesToSend.length}] Sent: ${relativePath} (${byteToWord(stat.size)})`);
  }

  await writeJsonFrame(socket, {label: 'transfer-complete'});

  let result: SuccessMessage;
  while (true) {
    const frame = await readJsonFrame<ChatMessage>(socket);
    if (frame.label === 'info') {
      console.log('[server info]', frame.meta.message);
    } else {
      result = frame as SuccessMessage;
      break;
    }
  }
  console.log('Push completed successfully.');
  if (result.meta.git) {
    console.log('Git:', JSON.stringify(result.meta.git));
  }
}

async function handlePullClient(socket: net.Socket, diff: MetaDiffForSyncUp, rootDir: string) {
  const {added = [], modified = [], moved = [], copied = [], deleted = []} = diff;

  const filesToReceive = added.length + modified.length;
  let received = 0;

  for (let i = 0; i < filesToReceive; i++) {
    const header = await readJsonFrame<AddFileMessage>(socket);
    const {relativePath, size} = header.meta;
    const filePath = path.join(rootDir, relativePath);
    await receiveFileFromSocket(socket, filePath, size);
    received++;
    console.log(`  [${received}/${filesToReceive}] Received: ${relativePath} (${byteToWord(size)})`);
  }

  await readJsonFrame<SimpleMessage>(socket);

  const getMetaHandlers = getFileMetaHandler();
  const metaHandlers = await getMetaHandlers(rootDir);

  for (const assetInfo of added) {
    const partialInfo = await getPartialAssetInfo({rootDir, relativePath: assetInfo.relativePath});
    await metaHandlers.createOrUpdateItem({
      info: {...partialInfo, sha1: assetInfo.sha1, shortId: assetInfo.shortId} as AssetInfoFull,
    });
  }

  for (const {to} of modified) {
    const partialInfo = await getPartialAssetInfo({rootDir, relativePath: to.relativePath});
    await metaHandlers.createOrUpdateItem({
      info: {...partialInfo, sha1: to.sha1, shortId: to.shortId} as AssetInfoFull,
    });
  }

  for (const {from, to} of moved) {
    const fromPath = path.join(rootDir, from.relativePath);
    const toPath = path.join(rootDir, to.relativePath);
    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, {recursive: true});
    if (fs.existsSync(fromPath)) {
      fs.renameSync(fromPath, toPath);
      const partialInfo = await getPartialAssetInfo({rootDir, relativePath: to.relativePath});
      await metaHandlers.createOrUpdateItem({
        info: {...partialInfo, sha1: to.sha1, shortId: to.shortId} as AssetInfoFull,
      });
      await metaHandlers.removeItem(from.relativePath);
    }
  }

  for (const {from, to} of copied) {
    const fromPath = path.join(rootDir, from.relativePath);
    const toPath = path.join(rootDir, to.relativePath);
    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, {recursive: true});
    if (fs.existsSync(fromPath)) {
      fs.copyFileSync(fromPath, toPath);
      const partialInfo = await getPartialAssetInfo({rootDir, relativePath: to.relativePath});
      await metaHandlers.createOrUpdateItem({
        info: {...partialInfo, sha1: to.sha1, shortId: to.shortId} as AssetInfoFull,
      });
    }
  }

  for (const assetInfo of deleted) {
    const filePath = path.join(rootDir, assetInfo.relativePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await metaHandlers.removeItem(assetInfo.relativePath);
  }

  console.log('Pull completed successfully.');
}
