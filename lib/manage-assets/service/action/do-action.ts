import fs from 'fs';
import path from 'path';
import {
  ActionToAssetsAndMeta,
  AssetInfoFull,
  CopyAction,
  DoSyncUpAssetActionOptions,
  MetaHandlers,
} from '../../types';
import {logColorful, getFilePathInfo, moveFile} from '../../external';
import {getPartialAssetInfo} from '../asset-info';
import {parseFilePath} from '../short-id';
import {formatDate} from '../../../../external';

export function needActionToAssetsAndMeta(allActions: ActionToAssetsAndMeta) {
  const {copyFiles = [], moveFiles = [], deleteFiles = []} = allActions;
  const isNeedAction =
    [copyFiles, deleteFiles, moveFiles].reduce<number>((sum, it) => {
      return sum + it.length;
    }, 0) > 0;
  return isNeedAction;
}

function getSoftDeleteFileHandler(dir4DeletedFile?: string) {
  if (dir4DeletedFile && !fs.existsSync(dir4DeletedFile)) {
    throw new Error(`dir4DeletedFile not exist: ${dir4DeletedFile}`);
  }
  function softDeleteFile(rootDir: string, assetInfo: AssetInfoFull, options?: DoSyncUpAssetActionOptions) {
    const {relativePath, shortId} = assetInfo;
    const fullPath = path.join(rootDir, relativePath);
    if (dir4DeletedFile) {
      const {extname} = getFilePathInfo(fullPath);
      const newPath = path.join(dir4DeletedFile, shortId + extname);
      if (!fs.existsSync(newPath)) {
        moveFile(fullPath, newPath);
        options?.logging && logColorful({color: 'blue'}, `move file from ${fullPath} to ${newPath}`);
      }
    }
    options?.logging && logColorful({color: 'blue'}, `delete file: ${fullPath}`);
    fs.unlinkSync(fullPath);
  }
  return softDeleteFile;
}

export async function doActionsToAssetsAndMeta(
  allActions: Partial<ActionToAssetsAndMeta>,
  metaHandlers: MetaHandlers,
  options?: DoSyncUpAssetActionOptions
) {
  options = options ?? {};
  const {notChangeAsset, dir4DeletedFile, dirPrefix4NewFile, snapShotMetaBeforeAction, logging} = options;
  const defaultDirPrefix4NewFile = `new-file-${formatDate(new Date(), 'yyyy-MM-ddThh:mm:ss')}`;

  if (!needActionToAssetsAndMeta(allActions)) {
    return false;
  }
  if (dir4DeletedFile && !fs.existsSync(dir4DeletedFile)) {
    throw new Error(`dir4DeletedFile not exist: ${dir4DeletedFile}`);
  }
  const softDeleteFile = getSoftDeleteFileHandler(dir4DeletedFile);
  const {rootDir, insertOrUpdateItem, removeItem, snapshot} = metaHandlers;
  if (snapShotMetaBeforeAction && snapshot) {
    const filePath = await snapshot();
    logging && logColorful({color: 'yellow'}, `snapshot meta in ${filePath}`);
  }
  const {copyFiles = [], moveFiles = [], deleteFiles = []} = allActions;
  const referMoveCntMap: Record<string, number> = {};
  for (const aciton of moveFiles) {
    const {
      from: {
        asset: {relativePath},
      },
    } = aciton;
    if (referMoveCntMap[relativePath] === undefined) {
      referMoveCntMap[relativePath] = 0;
    }
    referMoveCntMap[relativePath]++;
  }

  // do delete action first
  for (const info of deleteFiles) {
    !notChangeAsset && softDeleteFile(rootDir, info, options);
    Boolean(removeItem) && (await removeItem(info.relativePath));
  }
  try {
    const sameDirActions: CopyAction[] = [];
    const crossDirActions: CopyAction[] = [];
    for (const action of [...copyFiles, ...moveFiles]) {
      const {from, to} = action;
      if (from.rootDir === to.rootDir) {
        sameDirActions.push(action);
      } else {
        crossDirActions.push(action);
      }
    }
    for (const action of [...sameDirActions, ...crossDirActions]) {
      const {from, to} = action;
      const {
        asset: {relativePath, sha1, shortId},
      } = from;
      const fromPath = path.join(from.rootDir, relativePath);
      let relativePath2: string;
      if (to.relativePath === undefined) {
        const {basename} = getFilePathInfo(relativePath);
        relativePath2 = path.join(dirPrefix4NewFile ?? defaultDirPrefix4NewFile, basename);
      } else {
        relativePath2 = path.join(dirPrefix4NewFile, to.relativePath);
      }
      const toPath = path.join(to.rootDir, relativePath2);
      logging && logColorful({color: 'blue'}, `copy file from ${fromPath} to ${toPath}`);
      !notChangeAsset && fs.copyFileSync(fromPath, toPath);
      Boolean(insertOrUpdateItem) &&
        (await insertOrUpdateItem({
          ...(await getPartialAssetInfo({rootDir: to.rootDir, relativePath: relativePath2})),
          sha1,
          shortId,
        }));

      /** remove the moveFile.from.asset when referCnt is zero */
      if (referMoveCntMap[relativePath] !== undefined) {
        referMoveCntMap[relativePath]--;
        if (referMoveCntMap[relativePath] === 0) {
          const {relativePath} = from.asset;
          !notChangeAsset && softDeleteFile(rootDir, from.asset, options);
          Boolean(removeItem) && (await removeItem(relativePath));
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}
