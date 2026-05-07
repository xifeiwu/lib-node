import * as fs from 'fs';
import * as path from 'path';
import {Socket} from 'net';
import {execFileSync} from 'child_process';
import {getFileMetaHandler} from '../service/file-meta-handler';
import {diffMetaForSyncUp, serializeMetaDiff} from '../service/diff-meta';
import {getPartialAssetInfo} from '../service/asset-info';
import type {AssetInfoFull, AssetListMeta, MetaDiffForSyncUp, MetaHandlers} from '../types';
import {
  ASSETS_SYNC_PROTOCOL_BYTE,
  AssetsSyncCommand,
  readExactly,
  readJsonFrame,
  writeJsonFrame,
  writeFileFrame,
  receiveFileFromSocket,
} from './protocol';
import {alignMetaWithAssets} from '../operation';

export {ASSETS_SYNC_PROTOCOL_BYTE};

interface CommandMessage {
  command: AssetsSyncCommand;
  meta: AssetListMeta;
}

export interface AssetsSyncServerConfig {
  dir: string;
  git?: string;
}

export async function handleAssetsSyncConnection(socket: Socket, config: AssetsSyncServerConfig) {
  const {dir, git} = config;

  try {
    await readExactly(socket, 1);
    const msg: CommandMessage = await readJsonFrame(socket);
    const {command, meta: clientMeta} = msg;

    const getMetaHandlers = getFileMetaHandler();
    const metaHandlers = await getMetaHandlers(dir);
    const serverMeta = await metaHandlers.getMeta();
    await alignMetaWithAssets(metaHandlers);

    let diff: MetaDiffForSyncUp;
    if (command === 'push' || command === 'diff') {
      diff = await diffMetaForSyncUp(serverMeta, clientMeta);
    } else {
      diff = await diffMetaForSyncUp(clientMeta, serverMeta);
    }

    await writeJsonFrame(socket, {diff: serializeMetaDiff(diff)});

    if (command === 'diff') {
      socket.end();
      return;
    }

    const confirmation = await readJsonFrame<{confirmed: boolean}>(socket);
    if (!confirmation.confirmed) {
      socket.end();
      return;
    }

    if (command === 'push') {
      await handlePush(socket, metaHandlers, diff);
      let gitResult: any;
      if (git) {
        try {
          gitResult = await gitSyncUp(dir, git);
        } catch (err) {
          gitResult = {error: String(err)};
        }
      }
      await writeJsonFrame(socket, {success: true, git: gitResult});
    } else if (command === 'pull') {
      await handlePull(socket, metaHandlers, diff);
    }

    socket.end();
  } catch (err) {
    console.error('[assets-sync] error:', err);
    try {
      await writeJsonFrame(socket, {error: String(err)});
    } catch {}
    socket.destroy();
  }
}

async function handlePush(socket: Socket, metaHandlers: MetaHandlers, diff: MetaDiffForSyncUp) {
  const {added = [], modified = [], moved = [], copied = [], deleted = []} = diff;
  const {rootDir} = metaHandlers;

  const filesToReceive = added.length + modified.length;
  for (let i = 0; i < filesToReceive; i++) {
    const header = await readJsonFrame<{file: string; size: number}>(socket);
    const filePath = path.join(rootDir, header.file);
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, {recursive: true});
    }
    await receiveFileFromSocket(socket, filePath, header.size);

    const partialInfo = await getPartialAssetInfo({rootDir, relativePath: header.file});
    const assetInfo =
      diff.added?.find(a => a.relativePath === header.file) ??
      diff.modified?.find(m => m.to.relativePath === header.file)?.to;
    if (assetInfo) {
      await metaHandlers.createOrUpdateItem({
        info: {...partialInfo, sha1: assetInfo.sha1, shortId: assetInfo.shortId} as AssetInfoFull,
      });
    }
  }

  const transferEnd = await readJsonFrame<{transferComplete: boolean}>(socket);

  for (const {from, to} of moved) {
    const fromPath = path.join(rootDir, from.relativePath);
    const toPath = path.join(rootDir, to.relativePath);
    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, {recursive: true});
    fs.renameSync(fromPath, toPath);
    await metaHandlers.createOrUpdateItem({
      info: {
        ...(await getPartialAssetInfo({rootDir, relativePath: to.relativePath})),
        sha1: to.sha1,
        shortId: to.shortId,
      } as AssetInfoFull,
    });
    await metaHandlers.removeItem(from.relativePath);
  }

  for (const {from, to} of copied) {
    const fromPath = path.join(rootDir, from.relativePath);
    const toPath = path.join(rootDir, to.relativePath);
    const toDir = path.dirname(toPath);
    if (!fs.existsSync(toDir)) fs.mkdirSync(toDir, {recursive: true});
    fs.copyFileSync(fromPath, toPath);
    await metaHandlers.createOrUpdateItem({
      info: {
        ...(await getPartialAssetInfo({rootDir, relativePath: to.relativePath})),
        sha1: to.sha1,
        shortId: to.shortId,
      } as AssetInfoFull,
    });
  }

  for (const assetInfo of deleted) {
    const filePath = path.join(rootDir, assetInfo.relativePath);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await metaHandlers.removeItem(assetInfo.relativePath);
  }
}

async function handlePull(socket: Socket, metaHandlers: MetaHandlers, diff: MetaDiffForSyncUp) {
  const {added = [], modified = []} = diff;
  const {rootDir} = metaHandlers;

  for (const assetInfo of added) {
    const filePath = path.join(rootDir, assetInfo.relativePath);
    const stat = fs.statSync(filePath);
    await writeJsonFrame(socket, {file: assetInfo.relativePath, size: stat.size});
    await writeFileFrame(socket, filePath, stat.size);
  }

  for (const {to} of modified) {
    const filePath = path.join(rootDir, to.relativePath);
    const stat = fs.statSync(filePath);
    await writeJsonFrame(socket, {file: to.relativePath, size: stat.size});
    await writeFileFrame(socket, filePath, stat.size);
  }

  await writeJsonFrame(socket, {transferComplete: true});
}

export async function gitSyncUp(
  dir: string,
  gitRemote: string
): Promise<{committed: boolean; pushed: boolean}> {
  const opts = {cwd: dir, encoding: 'utf8' as const};

  if (!fs.existsSync(path.join(dir, '.git'))) {
    execFileSync('git', ['init'], opts);
  }

  execFileSync('git', ['add', '.'], opts);

  const status = execFileSync('git', ['status', '--porcelain'], opts);
  if (!status.trim()) {
    return {committed: false, pushed: false};
  }

  const timestamp = new Date().toISOString();
  execFileSync('git', ['commit', '-m', `assets sync: ${timestamp}`], opts);

  try {
    execFileSync('git', ['remote', 'add', 'origin', gitRemote], opts);
  } catch {
    execFileSync('git', ['remote', 'set-url', 'origin', gitRemote], opts);
  }

  execFileSync('git', ['push', '-u', 'origin', 'HEAD'], opts);
  return {committed: true, pushed: true};
}
