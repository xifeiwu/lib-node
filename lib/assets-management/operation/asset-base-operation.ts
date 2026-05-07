import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {getFullAssetInfo, getPartialAssetInfo} from '../service';
import {removeFile, makeSureDirExistForFile} from '../external';

/**
 * Add files from external paths into rootDir and create meta entries
 * @param metaHandlers
 * @param files - list of { sourcePath: absolute path of source file, relativePath: target relative path in rootDir }
 */
export async function addAssetMeta(
  metaHandlers: MetaHandlers,
  files: {sourcePath: string; relativePath: string}[]
) {
  const {rootDir} = metaHandlers;
  const added: AssetInfoFull[] = [];
  for (const {sourcePath, relativePath} of files) {
    const toPath = path.join(rootDir, relativePath);
    makeSureDirExistForFile(toPath);
    fs.copyFileSync(sourcePath, toPath);
    const info = await getFullAssetInfo({rootDir, relativePath});
    await metaHandlers.createItem(info);
    added.push(info);
  }
  return added;
}

/**
 * Copy files within the same rootDir to new paths and create meta entries
 * @param metaHandlers
 * @param files - list of { fromRelativePath, toRelativePath }
 */
export async function copyAssetMeta(
  metaHandlers: MetaHandlers,
  files: {fromRelativePath: string; toRelativePath: string}[]
) {
  const {rootDir} = metaHandlers;
  const copied: AssetInfoFull[] = [];
  for (const {fromRelativePath, toRelativePath} of files) {
    const fromPath = path.join(rootDir, fromRelativePath);
    const toPath = path.join(rootDir, toRelativePath);
    makeSureDirExistForFile(toPath);
    fs.copyFileSync(fromPath, toPath);
    const fromInfoList = await metaHandlers.findItems({relativePath: fromRelativePath});
    const fromInfo = fromInfoList[0];
    const info: AssetInfoFull = {
      ...(await getPartialAssetInfo({rootDir, relativePath: toRelativePath})),
      sha1: fromInfo?.sha1,
      shortId: fromInfo?.shortId,
    } as AssetInfoFull;
    await metaHandlers.createItem(info);
    copied.push(info);
  }
  return copied;
}

/**
 * Delete files from rootDir and remove meta entries
 * @param metaHandlers
 * @param relativePaths - list of relative paths to delete
 */
export async function deleteAssetMeta(metaHandlers: MetaHandlers, relativePaths: string[]) {
  const {rootDir} = metaHandlers;
  for (const relativePath of relativePaths) {
    const filePath = path.join(rootDir, relativePath);
    removeFile(filePath);
  }
  await metaHandlers.removeItems(relativePaths);
}
