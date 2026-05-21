import fs, {writeFileSync} from 'fs';
import path from 'path';
import {AssetInfoFull, MetaDiffForImportNew, MetaHandlers} from '../types';
import {
  appendShortIdToFilePath,
  diffAssets,
  diffMetaForImportNew,
  DIR_ASSET_MANAGE_TMP_DIR,
  FILE_SUFFIX_DT_FORMAT,
  getFileMetaHandler,
  getFullAssetInfo,
  getPartialAssetInfo,
  parseFilePath,
  serializeMetaDiff,
} from '../service';
import {
  removeFile,
  makeSureDirExistForFile,
  resolvePathInRoot,
  goOnOrNot,
  getFileList,
  toDtStr,
  addDtSuffixToBareBasename,
  convertObjectToCjsExport,
  byteToWord,
  getFilePathInfo,
} from '../external';

async function addAssetWithInfo(
  target: {metaHandler: MetaHandlers; relativePath: string},
  source: {assetInfo: AssetInfoFull; fullpath: string}
) {
  const {assetInfo, fullpath: sourceFullPath} = source;
  const {sha1, shortId} = assetInfo;
  if (!fs.existsSync(sourceFullPath)) {
    throw new Error(`source file not exist: ${sourceFullPath}`);
  }
  const {metaHandler} = target;
  let targetRelativePath = target.relativePath;
  const {rootDir: targetRootDir} = metaHandler;
  let targetFullPath = path.join(targetRootDir, targetRelativePath);
  if (sourceFullPath === targetFullPath) {
    return;
  }

  /** append short id to target path if target file already exists */
  if (fs.existsSync(targetFullPath)) {
    targetRelativePath = appendShortIdToFilePath(targetRelativePath, shortId);
    targetFullPath = path.join(targetRootDir, targetRelativePath);
  }
  makeSureDirExistForFile(targetFullPath);
  fs.copyFileSync(sourceFullPath, targetFullPath);
  const targetPartialInfo = await getPartialAssetInfo({
    rootDir: targetRootDir,
    relativePath: targetRelativePath,
  });
  const targetAssetInfo = {
    ...targetPartialInfo,
    sha1,
    shortId,
  } as AssetInfoFull;
  await metaHandler.createItem(targetAssetInfo);
  return {source: assetInfo, target: targetAssetInfo};
}

async function addSingleAsset(
  metaHandler: MetaHandlers,
  options: {
    /** can be relative path or absolute path */
    sourcePath: string;
    /** must be relative path */
    targetPath: string;
  }
) {
  const {sourcePath, targetPath} = options;
  const {rootDir} = metaHandler;
  const {fullpath: sourceFullPath, relativePath: sourceRelativePath} = resolvePathInRoot(rootDir, sourcePath);
  const {fullpath: targetFullPath, relativePath: targetRelativePath} = resolvePathInRoot(rootDir, targetPath);
  if (!fs.existsSync(sourceFullPath)) {
    throw new Error(`source file not exist: ${sourceFullPath}`);
  }
  if (!targetRelativePath) {
    throw new Error(`target path must be relative path in rootDir: ${rootDir}, but ${targetPath} is not.`);
  }
  let info: AssetInfoFull;

  /** sourceRelativePath is undefined means the source is an external source */
  if (!sourceRelativePath) {
    /** copy from external source */
    // fs.copyFileSync(sourceFullPath, targetFullPath);
    const {dirname, basename} = getFilePathInfo(sourceFullPath);
    info = await getFullAssetInfo({rootDir: dirname, relativePath: basename});
  } else {
    /** the source file is internal file */
    const [currentInfo] = await metaHandler.findItems({relativePath: sourceRelativePath});
    // if (sourceFullPath !== targetFullPath) {
    //   fs.copyFileSync(sourceFullPath, targetFullPath);
    // }

    if (!currentInfo) {
      info = await getFullAssetInfo({rootDir, relativePath: targetRelativePath});
    } else {
      const sourcePartialInfo = await getPartialAssetInfo({rootDir, relativePath: sourceRelativePath});
      /** check whether currentInfo is outdated */
      if (
        diffAssets(sourcePartialInfo as AssetInfoFull, currentInfo, [
          'relativePath',
          'extname',
          'size',
          'modifyDate',
        ])
      ) {
        info = await getFullAssetInfo({rootDir, relativePath: targetRelativePath});
      } else {
        info = currentInfo;
      }
    }
  }
  return addAssetWithInfo(
    {metaHandler, relativePath: targetRelativePath},
    {assetInfo: info, fullpath: sourceFullPath}
  );
}

/**
 * Only add new assets from external folder to rootDir.
 * Will not add assets that already exist in rootDir.
 */
async function addNewAssetsFromExternalFolder(
  metaHandler: MetaHandlers,
  options?: {
    sourceDir: string;
    targetRelativeDir: string;
    outputDir?: string;
    runDirectly?: boolean;
  }
) {
  const result: Array<{source: AssetInfoFull; target: AssetInfoFull}> = [];
  const {rootDir: targetRootDir} = metaHandler;
  const {sourceDir, targetRelativeDir, outputDir = DIR_ASSET_MANAGE_TMP_DIR, runDirectly} = options ?? {};
  if (!fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`sourceDir is not a directory: ${sourceDir}`);
  }
  const {relativePath: sourceRelativePath} = resolvePathInRoot(targetRootDir, sourceDir);
  if (sourceRelativePath) {
    throw new Error(
      `sourceDir[${sourceDir}] must be an external dir, compared to rootDir: ${targetRootDir}.`
    );
  }
  const {relativePath: targetRelativePath, fullpath: targetFullPath} = resolvePathInRoot(
    targetRootDir,
    targetRelativeDir
  );
  if (!targetRelativePath) {
    throw new Error(
      `targetDir must be relative path in rootDir: ${targetRootDir}, but ${targetRelativeDir} is not.`
    );
  }
  if (fs.existsSync(targetFullPath) && !fs.statSync(targetFullPath).isDirectory()) {
    throw new Error(`targetDir exist, but is not a folder: ${targetFullPath}`);
  }
  makeSureDirExistForFile(targetFullPath);

  const sourceMetaHandlder = await getFileMetaHandler({runDirectly})(sourceDir);
  const targetMeta = await metaHandler.getMeta();
  const sourceMeta = await sourceMetaHandlder.getMeta();
  const difference = await diffMetaForImportNew(targetMeta, sourceMeta);
  if (!difference.isNeedAction) {
    return result;
  }
  if (runDirectly !== true) {
    const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'import-assets-diff.js'), {
      dtFormat: FILE_SUFFIX_DT_FORMAT,
    });
    writeFileSync(
      stateFile,
      convertObjectToCjsExport({difference: serializeMetaDiff(difference)}, {format: true})
    );
    if (
      !(await goOnOrNot({
        tips: [
          `import assets from: ${targetFullPath}`,
          `to dir: ${targetRootDir}`,
          `state change is saved to file: ${stateFile}`,
          `Are you sure to apply state change above?`,
        ],
        style: {color: 'yellow'},
        defaultValue: true,
      }))
    ) {
      return result;
    }
  }
  const {added = [], duplicated} = difference;
  const totalSize = added.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  let copiedSize = 0;
  let copiedCount = 0;
  for (const assetInfo of added) {
    const {relativePath} = assetInfo;
    const info = await addAssetWithInfo(
      {metaHandler, relativePath},
      {assetInfo, fullpath: path.join(sourceDir, relativePath)}
    );
    result.push(info);
    copiedSize += assetInfo.size;
    copiedCount++;
    console.log(
      `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%), copied count:${copiedCount} / ${added.length}`
    );
  }
  return result;
}

/**
 * Add files into rootDir and create meta entries.
 *
 * @param metaHandlers
 * @param files - list of { sourcePath: path of source file or folder, toRelativePath: target relative path in rootDir }
 */
export async function addAsset(
  metaHandlers: MetaHandlers,
  files: {sourcePath: string; targetPath?: string}[],
  options?: {
    overwrite?: boolean;
    runDirectly?: boolean;
  }
) {
  const {rootDir} = metaHandlers;
  const {runDirectly} = options ?? {};
  const defaultTargetDir = `new-assets-${toDtStr(new Date(), 'yyyy-MM-ddThh-mm-ss')}`;
  const result: Array<{source: AssetInfoFull; target: AssetInfoFull}> = [];
  for (const file of files) {
    /** check source */
    const {fullpath: sourceFullPath, relativePath: sourceRelativePath} = resolvePathInRoot(
      rootDir,
      file.sourcePath
    );
    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`source path not exist: ${sourceFullPath}`);
    }
    const sourceStat = fs.statSync(sourceFullPath);
    /** not handle symlink */
    if (sourceStat.isSymbolicLink()) {
      continue;
    }
    /** check target */
    if (file.targetPath) {
      const {fullpath: targetFullPath, relativePath: targetRelativePath} = resolvePathInRoot(
        rootDir,
        file.targetPath
      );
      if (!targetRelativePath) {
        throw new Error(
          `target path must be relative path in rootDir: ${rootDir}, but ${file.targetPath} is not.`
        );
      }
      if (fs.existsSync(targetFullPath)) {
        throw new Error(`target path already exist: ${targetFullPath}`);
      }
    }
    let targetPath = file.targetPath;

    /** start to add asset */
    /** sourceRelativePath is undefined means the source is an external source */
    if (!sourceRelativePath) {
      if (sourceStat.isDirectory()) {
        targetPath = targetPath ?? defaultTargetDir;
        const folderName = path.basename(sourceFullPath);
        const info = await addNewAssetsFromExternalFolder(metaHandlers, {
          sourceDir: sourceFullPath,
          targetRelativeDir: path.join(targetPath, folderName),
          runDirectly,
        });
        result.push(...info);
      } else {
        targetPath = targetPath ?? path.basename(sourceFullPath);
        const info = await addSingleAsset(metaHandlers, {sourcePath: sourceFullPath, targetPath: targetPath});
        result.push(info);
      }
    } else {
      if (fs.statSync(sourceFullPath).isDirectory()) {
        const {relativePath: toRelativePath} = resolvePathInRoot(rootDir, file.targetPath);
        if (!toRelativePath) {
          throw new Error(
            `target path must be relative path in rootDir: ${rootDir}, but ${file.targetPath} is not.`
          );
        }
        const fileList = getFileList(sourceFullPath, {includeDir: false});
        for (const relPath of fileList) {
          const info = await addSingleAsset(metaHandlers, {
            sourcePath: relPath,
            targetPath: targetPath ?? path.join(defaultTargetDir, relPath),
          });
          result.push(info);
        }
      } else {
        const info = await addSingleAsset(metaHandlers, {
          sourcePath: sourceRelativePath,
          targetPath: targetPath ?? path.join(defaultTargetDir, sourceRelativePath),
        });
        result.push(info);
      }
    }
  }
  return result;
}

function resolveInternalPath(rootDir: string, filePath: string, label: string) {
  const {fullpath, relativePath} = resolvePathInRoot(rootDir, filePath);
  if (!relativePath) {
    throw new Error(`${label} must be relative path in rootDir: ${rootDir}, but ${filePath} is not.`);
  }
  if (!fs.existsSync(fullpath)) {
    throw new Error(`${label} not exist: ${fullpath}`);
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
    const {fullpath, relativePath} = resolveInternalPath(rootDir, filePath, 'filePath');
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

/**
 * Copy files or folders within rootDir and create meta entries for the targets.
 * Both sourcePath and targetPath must be relative paths within rootDir.
 * Delegates to addAsset after validating source paths are internal.
 * @param metaHandlers
 * @param pathList - list of { sourcePath, targetPath } relative to rootDir
 */
export async function copyAsset(
  metaHandlers: MetaHandlers,
  pathList: {sourcePath: string; targetPath: string}[],
  options?: {overwrite?: boolean}
) {
  const {rootDir} = metaHandlers;
  for (const {sourcePath} of pathList) {
    resolveInternalPath(rootDir, sourcePath, 'sourcePath');
  }
  return addAsset(metaHandlers, pathList, options);
}

/**
 * Move files or folders within rootDir and update meta entries.
 * Both sourcePath and targetPath must be relative paths within rootDir.
 * Delegates to addAsset (copy + create meta) then deleteAsset (remove source + remove meta).
 * @param metaHandlers
 * @param pathList - list of { sourcePath, targetPath } relative to rootDir
 */
export async function moveAsset(
  metaHandlers: MetaHandlers,
  pathList: {sourcePath: string; targetPath: string}[],
  options?: {overwrite?: boolean}
) {
  const {rootDir} = metaHandlers;
  for (const {sourcePath} of pathList) {
    resolveInternalPath(rootDir, sourcePath, 'sourcePath');
  }
  const added = await addAsset(metaHandlers, pathList, options);
  await deleteAsset(
    metaHandlers,
    pathList.map(it => it.sourcePath)
  );
  return added;
}
