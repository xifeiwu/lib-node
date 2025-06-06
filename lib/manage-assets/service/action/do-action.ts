import fs from 'fs';
import path from 'path';
import {ActionToAssetsAndMeta, CopyAction, DoSyncUpAssetActionOptions, MetaHandlers} from '../../types';
import {logColorful} from '../../external';
import {getPartialAssetInfo} from '../asset-info';

export function needActionToAssetsAndMeta(allActions: ActionToAssetsAndMeta) {
  const {copyFiles = [], moveFiles = [], deleteFiles = []} = allActions;
  const isNeedAction =
    [copyFiles, deleteFiles, moveFiles].reduce<number>((sum, it) => {
      return sum + it.length;
    }, 0) > 0;
  return isNeedAction;
}

export async function doActionsToAssetsAndMeta(
  allActions: Partial<ActionToAssetsAndMeta>,
  metaHandlers: MetaHandlers,
  options?: DoSyncUpAssetActionOptions
) {
  const {
    notChangeAsset,
    dirPrefix4NewFile = '',
    dir4DeletedFile,
    snapShotMetaBeforeAction,
    logging,
  } = options ?? {};
  if (!needActionToAssetsAndMeta(allActions)) {
    return false;
  }
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
  for (const relativePath of deleteFiles) {
    const fullPath = path.join(rootDir, relativePath);
    logging && logColorful({color: 'blue'}, `delete file: ${fullPath}`);
    !notChangeAsset && fs.unlinkSync(fullPath);
    Boolean(removeItem) && (await removeItem(relativePath));
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
      const relativePath2 =
        from.rootDir !== to.rootDir ? path.join(dirPrefix4NewFile, to.asset.relativePath) : relativePath;
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
          const fullPath = path.join(from.rootDir, relativePath);
          logging && logColorful({color: 'blue'}, `delete file: ${fullPath}`);
          !notChangeAsset && fs.unlinkSync(fullPath);
          Boolean(removeItem) && (await removeItem(relativePath));
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
}
