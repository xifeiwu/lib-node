import fs, {writeFileSync} from 'fs';
import path from 'path';
import {AssetInfoFull, IgnoredAssets, IgnoreReason, MetaHandlers, OperatedAssets} from '../types';
import {
  appendShortIdToFilePath,
  diffAssets,
  diffMetaForImportNew,
  DIR_ASSET_MANAGE_TMP_DIR,
  FILE_SUFFIX_DT_FORMAT,
  getFileMetaHandler,
  getFullAssetInfo,
  getPartialAssetInfo,
  serailizeAssetInfo,
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
  moveFile,
} from '../external';

interface AddAssetsOptions {
  /** run directly without confirmation */
  runDirectly?: boolean;
  /** by default, will ignore duplicated assets */
  addDuplicates?: boolean;
}

interface InternalTransferOptions {
  /** replace existing target files */
  overwrite?: boolean;
}

interface InternalTransferPair {
  sourceRelativePath: string;
  targetRelativePath: string;
  sourceFullPath: string;
  targetFullPath: string;
}

/**
 * What is done in this function:
 * 1. check source file exist
 * 2. check target file exist
 * 3. if target file exist, append short id to target path
 * 4. copy source file to target file
 * 5. create target partial info
 * 6. create target full info
 * 7. return target asset info
 * What it not do:
 * 1. whether source asset info is outdated
 * 1. check whether targetDir contains source file or not(by sha1 compare).
 * @param target
 * @param source
 * @returns
 */
async function doAddAction(
  target: {metaHandler: MetaHandlers; relativePath: string},
  source: {assetInfo: AssetInfoFull; fullPath: string}
) {
  const {assetInfo: sourceAssetInfo, fullPath: sourceFullPath} = source;
  const {sha1, shortId} = sourceAssetInfo;
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
  console.log(`copying [${byteToWord(sourceAssetInfo.size)}] from ${sourceFullPath} to ${targetFullPath}`);
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
  return {source: sourceAssetInfo, target: targetAssetInfo};
}

/**
 * When source is an external folder, this function will add metaHandler for source dir.
 * What is not done in this function, these logic should be done in caller::
 * 1. whether options.sourceFullPath is exists
 * 2. whether options.targetRelativeDir is a valid relative path in rootDir
 */
async function addNewAssetsFromExternalFolder(
  metaHandler: MetaHandlers,
  options?: {
    /** must be an external dir */
    sourceFullPath: string;
    /** must be relative path in rootDir */
    targetRelativeDir: string;
    outputDir?: string;
  } & AddAssetsOptions
) {
  const addedFileList: Array<OperatedAssets> = [];
  const {rootDir: targetRootDir} = metaHandler;
  const {
    sourceFullPath: sourceFullpath,
    targetRelativeDir,
    outputDir = DIR_ASSET_MANAGE_TMP_DIR,
    runDirectly,
    addDuplicates,
  } = options ?? {};
  const {fullPath: targetFullPath} = resolvePathInRoot(targetRootDir, targetRelativeDir);
  makeSureDirExistForFile(targetFullPath);

  const sourceMetaHandlder = await getFileMetaHandler({runDirectly})(sourceFullpath);
  const targetMeta = await metaHandler.getMeta();
  const sourceMeta = await sourceMetaHandlder.getMeta();
  const difference = await diffMetaForImportNew(targetMeta, sourceMeta);
  const {fromDir, toDir, newFiles = [], duplicatedFiles = {}} = difference;
  if (!difference.isNeedAction) {
    return addedFileList;
  }
  if (runDirectly !== true) {
    const stateFile = addDtSuffixToBareBasename(path.join(outputDir, 'import-dir-assets-new-files-.js'), {
      dtFormat: FILE_SUFFIX_DT_FORMAT,
    });
    writeFileSync(
      stateFile,
      convertObjectToCjsExport(
        {fromDir, toDir, newFiles: newFiles.map(it => serailizeAssetInfo(it))},
        {format: true}
      )
    );
    if (
      !(await goOnOrNot({
        tips: [
          `import assets`,
          `from dir: ${targetFullPath}`,
          `to dir: ${targetRootDir}`,
          `state change is saved to file: ${stateFile}`,
          `Are you sure to apply state change above?`,
        ],
        style: {color: 'blue'},
        defaultValue: true,
      }))
    ) {
      return addedFileList;
    }
  }
  // const totalSize = newFiles.reduce((acc, assetInfo) => acc + assetInfo.size, 0);
  // let copiedSize = 0;
  // let copiedCount = 0;
  for (const assetInfo of [
    ...newFiles,
    ...(addDuplicates ? Object.values(duplicatedFiles).flatMap(it => it.origin) : []),
  ]) {
    const {relativePath} = assetInfo;
    const info = await doAddAction(
      {metaHandler, relativePath},
      {assetInfo, fullPath: path.join(sourceFullpath, relativePath)}
    );
    addedFileList.push(info);
    // copiedSize += assetInfo.size;
    // copiedCount++;
    // console.log(
    //   `copied size:${byteToWord(copiedSize)} / ${byteToWord(totalSize)} (${((copiedSize / totalSize) * 100).toFixed(2)}%), copied count:${copiedCount} / ${newFiles.length}`
    // );
  }
  return addedFileList;
}

async function checkInternalAssetInfo(metaHandler: MetaHandlers, relativePath: string) {
  const {rootDir} = metaHandler;
  let assetInfo: AssetInfoFull;
  const [currentInfo] = await metaHandler.findItems({relativePath});
  if (!currentInfo) {
    throw new Error(`asset info not found for relative path: ${relativePath}`);
  }
  const sourcePartialInfo = await getPartialAssetInfo({rootDir, relativePath});
  /** check whether currentInfo is outdated */
  if (
    diffAssets(sourcePartialInfo as AssetInfoFull, currentInfo, [
      'relativePath',
      'extname',
      'size',
      'modifyDate',
    ])
  ) {
    assetInfo = await getFullAssetInfo({rootDir, relativePath});
    await metaHandler.updateItem({info: assetInfo, prevInfo: currentInfo});
  } else {
    assetInfo = currentInfo;
  }
  return assetInfo;
}
/**
 * Add files into rootDir and create meta entries.
 * @param metaHandler
 * @param files - list of { sourcePath: path of source file or folder, toRelativePath: target relative path in rootDir }
 * @param files[0].sourcePath - will ignore source file if it already exists in rootDir(by sha1 compare)
 * @param files[0].targetPath - will add source file when targetPath is specified.
 */
export async function addAssets(
  metaHandler: MetaHandlers,
  files: {sourcePath: string; targetPath?: string}[],
  options?: AddAssetsOptions
) {
  const {rootDir} = metaHandler;
  const {runDirectly, addDuplicates} = options ?? {};
  const defaultTargetDir = `new-assets-${toDtStr(new Date(), 'yyyy-MM-ddThh-mm-ss')}`;
  const results: Array<OperatedAssets> = [];
  const ignored: Array<IgnoredAssets> = [];
  for (const file of files) {
    /** check source */
    const {fullPath: sourceFullPath, relativePath: sourceRelativePath} = resolvePathInRoot(
      rootDir,
      file.sourcePath
    );
    if (!fs.existsSync(sourceFullPath)) {
      throw new Error(`source path not exist: ${sourceFullPath}`);
    }
    const sourceStat = fs.lstatSync(sourceFullPath);
    /** not handle symlink */
    if (sourceStat.isSymbolicLink()) {
      ignored.push({sourcePath: sourceFullPath, reason: IgnoreReason.IS_LINK});
      continue;
    }
    /** check target if provide */
    if (file.targetPath) {
      const {fullPath: targetFullPath, relativePath: targetRelativePath} = resolvePathInRoot(
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

    /** start to add asset */
    /** sourceRelativePath is undefined means the source is an external source */
    if (sourceRelativePath === undefined) {
      if (sourceStat.isDirectory()) {
        const targetRelativeDir =
          file.targetPath ?? path.join(defaultTargetDir, path.basename(sourceFullPath));
        const info = await addNewAssetsFromExternalFolder(metaHandler, {
          sourceFullPath: sourceFullPath,
          targetRelativeDir,
          runDirectly,
        });
        results.push(...info);
      } else {
        const targetRelativePath =
          file.targetPath ?? path.join(defaultTargetDir, path.basename(sourceFullPath));
        const sourceInfo = await getFullAssetInfo({fullPath: sourceFullPath});
        const [currentInfo] = await metaHandler.findItems({sha1: sourceInfo.sha1});
        if (currentInfo) {
          ignored.push({sourceInfo: sourceInfo, duplicatedInfo: currentInfo, reason: IgnoreReason.IS_EXIST});
        } else {
          const result = await doAddAction(
            {metaHandler, relativePath: targetRelativePath},
            {assetInfo: sourceInfo, fullPath: sourceFullPath}
          );
          results.push(result);
        }
      }
    } else {
      if (!file.targetPath) {
        throw new Error(`target path must be provided during addAssets when source is internal file`);
      }
      const {relativePath: targetRelativePath} = resolvePathInRoot(rootDir, file.targetPath);
      if (fs.statSync(sourceFullPath).isDirectory()) {
        const fileList = getFileList(sourceFullPath, {includeDir: false});
        for (const relPath of fileList) {
          const internalRelativePath = path.join(sourceRelativePath, relPath);
          const internalTargetRelativePath = path.join(targetRelativePath, relPath);
          const sourceInfo = await checkInternalAssetInfo(metaHandler, internalRelativePath);
          const result = await doAddAction(
            {metaHandler, relativePath: internalTargetRelativePath},
            {assetInfo: sourceInfo, fullPath: path.join(sourceFullPath, relPath)}
          );
          results.push(result);
        }
      } else {
        const sourceInfo = await checkInternalAssetInfo(metaHandler, sourceRelativePath);
        const result = await doAddAction(
          {metaHandler, relativePath: targetRelativePath},
          {assetInfo: sourceInfo, fullPath: sourceFullPath}
        );
        results.push(result);
      }
    }
  }
  return {results, ignored};
}

/**
 * resolve @param filePath, and check whether it's relative path in @param rootDir
 */
function resolveInternalPath(rootDir: string, filePath: string) {
  const {fullPath, relativePath} = resolvePathInRoot(rootDir, filePath);
  if (!relativePath) {
    throw new Error(`relative path constranit fail in rootDir: ${rootDir}, but ${filePath} is not.`);
  }
  if (!fs.existsSync(fullPath)) {
    throw new Error(`file not exist: ${fullPath}`);
  }
  return {fullPath, relativePath};
}

function resolveInternalTargetPath(rootDir: string, filePath: string) {
  const {fullPath, relativePath} = resolvePathInRoot(rootDir, filePath);
  if (!relativePath) {
    throw new Error(`target path must be relative path in rootDir: ${rootDir}, but ${filePath} is not.`);
  }
  return {fullPath, relativePath};
}

function assertTargetAvailable(targetFullPath: string, overwrite?: boolean) {
  if (!fs.existsSync(targetFullPath)) {
    return;
  }
  if (!overwrite) {
    throw new Error(`target path already exist: ${targetFullPath}`);
  }
  removeFile(targetFullPath);
}

function collectInternalTransferPairs(
  rootDir: string,
  sourcePath: string,
  targetPath: string
): InternalTransferPair[] {
  const {fullPath: sourceFullPath, relativePath: sourceRelativePath} = resolveInternalPath(
    rootDir,
    sourcePath
  );
  const {relativePath: targetRelativePath} = resolveInternalTargetPath(rootDir, targetPath);
  const pairs: InternalTransferPair[] = [];

  if (fs.statSync(sourceFullPath).isDirectory()) {
    const fileList = getFileList(sourceFullPath);
    if (fileList.length === 0) {
      throw new Error(`source directory is empty: ${sourceFullPath}`);
    }
    for (const relPath of fileList) {
      const sourceRel = path.join(sourceRelativePath, relPath);
      const targetRel = path.join(targetRelativePath, relPath);
      pairs.push({
        sourceRelativePath: sourceRel,
        targetRelativePath: targetRel,
        sourceFullPath: path.join(rootDir, sourceRel),
        targetFullPath: path.join(rootDir, targetRel),
      });
    }
  } else {
    pairs.push({
      sourceRelativePath,
      targetRelativePath,
      sourceFullPath,
      targetFullPath: path.join(rootDir, targetRelativePath),
    });
  }
  return pairs;
}

function removeEmptyDirIfNeeded(dirFullPath: string) {
  if (!fs.existsSync(dirFullPath) || !fs.statSync(dirFullPath).isDirectory()) {
    return;
  }
  if (getFileList(dirFullPath).length === 0) {
    removeFile(dirFullPath);
  }
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
    const {fullPath, relativePath} = resolveInternalPath(rootDir, filePath);
    if (fs.statSync(fullPath).isDirectory()) {
      const fileList = getFileList(fullPath);
      allRelativePaths.push(...fileList.map(f => path.join(relativePath, f)));
    } else {
      allRelativePaths.push(relativePath);
    }
    pathsToDelete.push(fullPath);
  }

  for (const fullPath of pathsToDelete) {
    removeFile(fullPath);
  }
  await metaHandlers.removeItems(allRelativePaths);
}

/**
 * Copy files or folders within rootDir and create meta entries for the targets.
 * Both sourcePath and targetPath must be relative paths within rootDir.
 * @param metaHandlers
 * @param pathList - list of { sourcePath, targetPath } relative to rootDir
 */
export async function copyAsset(
  metaHandlers: MetaHandlers,
  pathList: {sourcePath: string; targetPath: string}[],
  options?: InternalTransferOptions
) {
  const {rootDir} = metaHandlers;
  const {overwrite} = options ?? {};
  const results: Array<OperatedAssets> = [];

  for (const {sourcePath, targetPath} of pathList) {
    const pairs = collectInternalTransferPairs(rootDir, sourcePath, targetPath);
    for (const pair of pairs) {
      assertTargetAvailable(pair.targetFullPath, overwrite);
      const sourceInfo = await checkInternalAssetInfo(metaHandlers, pair.sourceRelativePath);
      const result = await doAddAction(
        {metaHandler: metaHandlers, relativePath: pair.targetRelativePath},
        {assetInfo: sourceInfo, fullPath: pair.sourceFullPath}
      );
      results.push(result);
    }
  }
  return results;
}

async function doMoveAction(metaHandler: MetaHandlers, pair: InternalTransferPair): Promise<OperatedAssets> {
  const {sourceRelativePath, targetRelativePath, sourceFullPath, targetFullPath} = pair;
  const sourceInfo = await checkInternalAssetInfo(metaHandler, sourceRelativePath);
  if (sourceRelativePath === targetRelativePath) {
    return {source: sourceInfo, target: sourceInfo};
  }
  const {sha1, shortId} = sourceInfo;
  moveFile(sourceFullPath, targetFullPath);
  const targetPartialInfo = await getPartialAssetInfo({
    rootDir: metaHandler.rootDir,
    relativePath: targetRelativePath,
  });
  const targetAssetInfo = {
    ...targetPartialInfo,
    sha1,
    shortId,
  } as AssetInfoFull;
  await metaHandler.createItem(targetAssetInfo);
  await metaHandler.removeItem(sourceRelativePath);
  return {source: sourceInfo, target: targetAssetInfo};
}

/**
 * Move files or folders within rootDir and update meta entries.
 * Both sourcePath and targetPath must be relative paths within rootDir.
 * @param metaHandlers
 * @param pathList - list of { sourcePath, targetPath } relative to rootDir
 */
export async function moveAsset(
  metaHandlers: MetaHandlers,
  pathList: {sourcePath: string; targetPath: string}[],
  options?: InternalTransferOptions
) {
  const {rootDir} = metaHandlers;
  const {overwrite} = options ?? {};
  const results: Array<OperatedAssets> = [];

  for (const {sourcePath, targetPath} of pathList) {
    const {fullPath: sourceFullPath} = resolveInternalPath(rootDir, sourcePath);
    const isSourceDirectory = fs.statSync(sourceFullPath).isDirectory();
    const pairs = collectInternalTransferPairs(rootDir, sourcePath, targetPath);
    for (const pair of pairs) {
      assertTargetAvailable(pair.targetFullPath, overwrite);
      const result = await doMoveAction(metaHandlers, pair);
      results.push(result);
    }
    if (isSourceDirectory) {
      removeEmptyDirIfNeeded(sourceFullPath);
    }
  }
  return results;
}
