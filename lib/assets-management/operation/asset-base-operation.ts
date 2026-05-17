import fs from 'fs';
import path from 'path';
import {AssetInfoFull, MetaHandlers} from '../types';
import {diffAssets, getFullAssetInfo, getPartialAssetInfo} from '../service';
import {removeFile, makeSureDirExistForFile, resolvePathInRoot, goOnOrNot} from '../external';

/**
 * Add files into rootDir and create meta entries.
 * - External source: copy the file and calculate full asset info.
 * - Internal source with no existing meta: copy the file and calculate full asset info.
 * - Internal source with matching partial info: reuse existing sha1/shortId to avoid hashing again.
 * - Internal source with changed partial info: calculate full asset info for the target file.
 * @param metaHandlers
 * @param files - list of { sourcePath: absolute path of source file, relativePath: target relative path in rootDir }
 */
export async function addAsset(
  metaHandlers: MetaHandlers,
  files: {sourcePath: string; toRelativePath: string}[],
  options?: {
    overwrite?: boolean;
  }
) {
  const {rootDir} = metaHandlers;
  const {overwrite = false} = options ?? {};
  const added: AssetInfoFull[] = [];
  for (const file of files) {
    const {fullpath: sourcePath, relativePath: sourceRelativePath} = resolvePathInRoot(
      rootDir,
      file.sourcePath
    );
    const {fullpath: toPath, relativePath: toRelativePath} = resolvePathInRoot(rootDir, file.toRelativePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`source file not exist: ${sourcePath}`);
    }
    if (!toRelativePath) {
      throw new Error(
        `target path must be relative path in rootDir: ${rootDir}, but ${toRelativePath} is not.`
      );
    }
    if (!overwrite && fs.existsSync(toPath)) {
      if (
        !goOnOrNot({
          tips: [`target file already exist: ${toPath}`, `overwrite?`],
          defaultValue: false,
        })
      ) {
        continue;
      }
    }
    let info: AssetInfoFull;
    makeSureDirExistForFile(toPath);

    if (path.isAbsolute(sourcePath)) {
      fs.copyFileSync(sourcePath, toPath);
      info = await getFullAssetInfo({rootDir, relativePath: toRelativePath});
    } else {
      const [currentInfo] = await metaHandlers.findItems({relativePath: sourceRelativePath});
      if (sourcePath !== toPath) {
        fs.copyFileSync(sourcePath, toPath);
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
    added.push(info);
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
 * Delete files from rootDir and remove meta entries
 * @param metaHandlers
 * @param files - list of relative paths to delete
 */
export async function deleteAssetMeta(metaHandlers: MetaHandlers, files: string[]) {
  const {rootDir} = metaHandlers;
  const resolvedPath = files.map(filePath => resolveDeletablePathInRoot(rootDir, filePath));
  for (const {fullpath} of resolvedPath) {
    removeFile(fullpath);
  }
  await metaHandlers.removeItems(resolvedPath.map(it => it.relativePath));
}
