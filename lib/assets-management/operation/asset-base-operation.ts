import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {diffAssets, getFullAssetInfo, getPartialAssetInfo} from '../service';
import {removeFile, makeSureDirExistForFile, resolvePathInRoot, goOnOrNot, getFileList} from '../external';

async function addSingleAsset(
  metaHandlers: MetaHandlers,
  sourcePath: string,
  targetPath: string,
  overwrite: boolean
): Promise<AssetInfoFull | null> {
  const {rootDir} = metaHandlers;
  const {fullpath: sourceFullPath, relativePath: sourceRelativePath} = resolvePathInRoot(rootDir, sourcePath);
  const {fullpath: toFullPath, relativePath: toRelativePath} = resolvePathInRoot(rootDir, targetPath);
  if (!fs.existsSync(sourceFullPath)) {
    throw new Error(`source file not exist: ${sourceFullPath}`);
  }
  if (!toRelativePath) {
    throw new Error(`target path must be relative path in rootDir: ${rootDir}, but ${targetPath} is not.`);
  }
  if (!overwrite && fs.existsSync(toFullPath)) {
    if (
      !goOnOrNot({
        tips: [`target file already exist: ${toFullPath}`, `overwrite?`],
        defaultValue: false,
      })
    ) {
      return null;
    }
  }
  let info: AssetInfoFull;
  makeSureDirExistForFile(toFullPath);

  if (!sourceRelativePath) {
    fs.copyFileSync(sourceFullPath, toFullPath);
    info = await getFullAssetInfo({rootDir, relativePath: toRelativePath});
  } else {
    const [currentInfo] = await metaHandlers.findItems({relativePath: sourceRelativePath});
    if (sourceFullPath !== toFullPath) {
      fs.copyFileSync(sourceFullPath, toFullPath);
    }

    if (!currentInfo) {
      info = await getFullAssetInfo({rootDir, relativePath: toRelativePath});
    } else {
      const sourcePartialInfo = await getPartialAssetInfo({rootDir, relativePath: sourceRelativePath});
      if (
        diffAssets(sourcePartialInfo as AssetInfoFull, currentInfo, [
          'relativePath',
          'extname',
          'size',
          'modifyDate',
        ])
      ) {
        info = await getFullAssetInfo({rootDir, relativePath: toRelativePath});
      } else {
        const targetPartialInfo = await getPartialAssetInfo({rootDir, relativePath: toRelativePath});
        info = {
          ...targetPartialInfo,
          sha1: currentInfo.sha1,
          shortId: currentInfo.shortId,
        } as AssetInfoFull;
      }
    }
  }

  await metaHandlers.createItem(info);
  return info;
}

/**
 * Add files into rootDir and create meta entries.
 * - sourcePath can be a file or a folder. When it's a folder, all files within are added recursively,
 *   and toRelativePath is treated as the target folder.
 * - External source: copy the file and calculate full asset info.
 * - Internal source with no existing meta: copy the file and calculate full asset info.
 * - Internal source with matching partial info: reuse existing sha1/shortId to avoid hashing again.
 * - Internal source with changed partial info: calculate full asset info for the target file.
 * @param metaHandlers
 * @param files - list of { sourcePath: path of source file or folder, toRelativePath: target relative path in rootDir }
 */
export async function addAsset(
  metaHandlers: MetaHandlers,
  files: {sourcePath: string; targetPath: string}[],
  options?: {
    overwrite?: boolean;
  }
) {
  const {rootDir} = metaHandlers;
  const {overwrite = false} = options ?? {};
  const added: AssetInfoFull[] = [];
  for (const file of files) {
    const {fullpath: resolvedSourcePath} = resolvePathInRoot(rootDir, file.sourcePath);
    if (!fs.existsSync(resolvedSourcePath)) {
      throw new Error(`source path not exist: ${resolvedSourcePath}`);
    }

    if (fs.statSync(resolvedSourcePath).isDirectory()) {
      const {fullpath: toFullPath, relativePath: toRelativePath} = resolvePathInRoot(
        rootDir,
        file.targetPath
      );
      if (!toRelativePath) {
        throw new Error(
          `target path must be relative path in rootDir: ${rootDir}, but ${file.targetPath} is not.`
        );
      }
      if (fs.existsSync(toFullPath) && !fs.statSync(toFullPath).isDirectory()) {
        throw new Error(`target path is a file, but source is a folder: ${toFullPath}`);
      }
      const fileList = getFileList(resolvedSourcePath);
      for (const relPath of fileList) {
        const src = path.join(resolvedSourcePath, relPath);
        const dest = path.join(file.targetPath, relPath);
        const info = await addSingleAsset(metaHandlers, src, dest, overwrite);
        if (info) added.push(info);
      }
    } else {
      const info = await addSingleAsset(metaHandlers, file.sourcePath, file.targetPath, overwrite);
      if (info) added.push(info);
    }
  }
  return added;
}

function resolveDeletablePathInRoot(rootDir: string, filePath: string) {
  const {fullpath, relativePath} = resolvePathInRoot(rootDir, filePath);
  if (!relativePath) {
    throw new Error(`filePath must be relative path in rootDir: ${rootDir}, but ${filePath} is not.`);
  }
  if (!fs.existsSync(fullpath)) {
    throw new Error(`filePath not exist: ${fullpath}`);
  }
  return {fullpath, relativePath};
}

/**
 * Delete files or folders from rootDir and remove meta entries.
 * When a path is a folder, all files within it are removed from meta and the folder is deleted.
 * @param metaHandlers
 * @param pathList - list of relative paths (files or folders) to delete
 */
export async function deleteAsset(metaHandlers: MetaHandlers, pathList: string[]) {
  const {rootDir} = metaHandlers;
  const allRelativePaths: string[] = [];
  const pathsToDelete: string[] = [];

  for (const filePath of pathList) {
    const {fullpath, relativePath} = resolveDeletablePathInRoot(rootDir, filePath);
    if (fs.statSync(fullpath).isDirectory()) {
      const fileList = getFileList(fullpath);
      allRelativePaths.push(...fileList.map(f => path.join(relativePath, f)));
    } else {
      allRelativePaths.push(relativePath);
    }
    pathsToDelete.push(fullpath);
  }

  for (const fullpath of pathsToDelete) {
    removeFile(fullpath);
  }
  await metaHandlers.removeItems(allRelativePaths);
}
