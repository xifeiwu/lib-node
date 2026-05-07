import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import {getFileMetaHandler} from '../service/file-meta-handler';
import {serailizeAssetInfo} from '../service/asset-info';
import {getPartialAssetInfo} from '../service/asset-info';
import {goOnOrNot} from '../external';
import {byteToWord} from '../external';
import type {AssetInfoFull, AssetListMeta, MetaDiffForSyncUp, MetaHandlers} from '../types';
import {
  ASSETS_SYNC_PROTOCOL_BYTE,
  AssetsSyncCommand,
  readJsonFrame,
  writeFrame,
  writeJsonFrame,
  writeFileFrame,
  receiveFileFromSocket,
} from './protocol';
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

function printDiffSummary(diff: MetaDiffForSyncUp) {
  const {added = [], deleted = [], modified = [], moved = [], copied = []} = diff;
  const totalSize = (list: AssetInfoFull[]) => list.reduce((sum, f) => sum + (f.size || 0), 0);

  console.log('\n--- Diff Summary ---');
  if (added.length) console.log(`  Added:    ${added.length} files (${byteToWord(totalSize(added))})`);
  if (modified.length) console.log(`  Modified: ${modified.length} files`);
  if (moved.length) console.log(`  Moved:    ${moved.length} files`);
  if (copied.length) console.log(`  Copied:   ${copied.length} files`);
  if (deleted.length) console.log(`  Deleted:  ${deleted.length} files`);
  if (!diff.isNeedAction) {
    console.log('  No changes needed.');
  }
  console.log('');
}

export async function runAssetsSyncCommand(
  command: AssetsSyncCommand,
  dir: string,
  options: {host: string; port: string}
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

  const response = await readJsonFrame<{diff: MetaDiffForSyncUp}>(socket);
  const {diff} = response;
  printDiffSummary(diff);

  if (command === 'diff' || !diff.isNeedAction) {
    socket.end();
    return;
  }

  const confirmed = await goOnOrNot({
    tips: [`Proceed with ${command}?`],
    defaultValue: true,
  });

  await writeJsonFrame(socket, {confirmed});
  if (!confirmed) {
    socket.end();
    return;
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
    await writeJsonFrame(socket, {file: relativePath, size: stat.size});
    await writeFileFrame(socket, filePath, stat.size);
    sent++;
    console.log(`  [${sent}/${filesToSend.length}] Sent: ${relativePath} (${byteToWord(stat.size)})`);
  }

  await writeJsonFrame(socket, {transferComplete: true});

  const result = await readJsonFrame<{success: boolean; git?: any}>(socket);
  if (result.success) {
    console.log('Push completed successfully.');
    if (result.git) {
      console.log('Git:', JSON.stringify(result.git));
    }
  }
}

async function handlePullClient(socket: net.Socket, diff: MetaDiffForSyncUp, rootDir: string) {
  const {added = [], modified = [], moved = [], copied = [], deleted = []} = diff;

  const filesToReceive = added.length + modified.length;
  let received = 0;

  for (let i = 0; i < filesToReceive; i++) {
    const header = await readJsonFrame<{file: string; size: number}>(socket);
    const filePath = path.join(rootDir, header.file);
    await receiveFileFromSocket(socket, filePath, header.size);
    received++;
    console.log(`  [${received}/${filesToReceive}] Received: ${header.file} (${byteToWord(header.size)})`);
  }

  const transferEnd = await readJsonFrame<{transferComplete: boolean}>(socket);

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
