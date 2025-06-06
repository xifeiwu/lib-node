import fs from 'fs';
import path from 'path';
import {applyStateChange, getAssetStateChange} from '../assets-meta';
import {getPathWithDtSuffix, goOnOrNot, logColorful} from '../../external';
import {MetaHandlers} from '../../types';
import {
  getRelativePathToAssetInfo,
  getShortIdToAssetInfo,
  toAssetInfoArray,
  doActionsToAssetsAndMeta,
  getMetaDir,
  needActionToAssetsAndMeta,
} from '../../service';
import {AssetInfoFull, ActionToAssetsAndMeta} from '../../types';

/**
 * Make sure file content of dir `to` the same as dir `from`.
 * As the compare cross different dirs, only use relativePath, shortId during comparison
 */
export async function getActionForSyncUpFiles(
  from: {assetInfoList: AssetInfoFull[]; rootDir: string},
  to: {assetInfoList: AssetInfoFull[]; rootDir: string}
): Promise<ActionToAssetsAndMeta> {
  // const idToInfo1 = getShortIdToAssetInfo(from.assetInfoList);
  const pathToInfo1 = getRelativePathToAssetInfo(from.assetInfoList);
  const idToInfo2 = getShortIdToAssetInfo(to.assetInfoList);
  const pathToInfo2 = getRelativePathToAssetInfo(to.assetInfoList);

  const paths1 = Object.keys(pathToInfo1);
  const paths2 = Object.keys(pathToInfo2);
  const pathAll = Array.from(new Set([...paths1, ...paths2]));
  const pathOnlyIn2: string[] = [];
  const pathOnlyIn1: string[] = [];
  const pathCommon: string[] = [];
  for (const p of pathAll) {
    let cnt = 0;
    cnt |= pathToInfo1[p] ? 1 : 0;
    cnt |= pathToInfo2[p] ? 2 : 0;
    if (cnt === 1) {
      pathOnlyIn1.push(p);
    } else if (cnt === 2) {
      pathOnlyIn2.push(p);
    } else if (cnt === 3) {
      pathCommon.push(p);
    } else {
      throw new Error(`id should not equal to ${p}`);
    }
  }

  /**
   * try to find same file in target dir to avoid cost by lookup idToInfo2
   */
  function getCopyActionInfo(assetInfo: AssetInfoFull) {
    const {relativePath} = assetInfo;
    const infoList2 = toAssetInfoArray(idToInfo2[assetInfo.shortId] ?? []);
    if (infoList2.length > 0) {
      /** try to recover the file by move aciton in rootDir2 to reduce resource cost */
      const deleted = infoList2.find(it => pathOnlyIn2.includes(it.relativePath));
      const asset = deleted ?? infoList2[0];
      const {sha1, shortId} = asset;
      return {
        sourceCanDelete: Boolean(deleted),
        action: {
          from: {
            rootDir: to.rootDir,
            asset: asset,
          },
          to: {
            rootDir: to.rootDir,
            asset: {
              sha1,
              shortId,
              relativePath,
            },
          },
        },
      };
    }
    return {
      sourceCanDelete: false,
      action: {
        from: {
          rootDir: from.rootDir,
          asset: assetInfo,
        },
        to: {
          rootDir: to.rootDir,
          asset: {
            sha1: assetInfo.sha1,
            shortId: assetInfo.shortId,
            relativePath,
          },
        },
      },
    };
  }
  const copyFiles: ActionToAssetsAndMeta['copyFiles'] = [];
  const moveFiles: ActionToAssetsAndMeta['moveFiles'] = [];

  for (const [relativePath, assetInfo1] of Object.entries(pathToInfo1)) {
    const assetInfo2 = pathToInfo2[relativePath];
    if (assetInfo2) {
      if (assetInfo2.shortId === assetInfo1.shortId) {
        continue;
      }
    }
    // try to find same file in target dir to avoid cost by lookup idToInfo2
    const result = getCopyActionInfo(assetInfo1);
    const {sourceCanDelete, action} = result;
    (sourceCanDelete ? moveFiles : copyFiles).push(action);
  }

  const filesToMove = moveFiles.map(it => it.from.asset.relativePath);
  // Not delete files that will be moved to another space
  const deleteFiles: Array<string> = pathOnlyIn2.filter(it => !filesToMove.includes(it));

  return {copyFiles, deleteFiles, moveFiles};
}

export async function syncUpAssetsBetweenDir(
  from: {rootDir: string; metaHandlers: MetaHandlers},
  to: {rootDir: string; metaHandlers: MetaHandlers},
  options?: {
    needConfirm?: boolean;
  }
) {
  const {needConfirm = true} = options ?? {};
  const stateChangeInfo1 = await getAssetStateChange(from.rootDir, from.metaHandlers);
  const stateChangeInfo2 = await getAssetStateChange(to.rootDir, to.metaHandlers);
  const isNeedAction = stateChangeInfo1.stateChange.isNeedAction || stateChangeInfo2.stateChange.isNeedAction;
  if (isNeedAction) {
    logColorful({color: 'red'}, 'apply change to assets meta as there are some change on assets');
    if (stateChangeInfo1.stateChange.isNeedAction) {
      await applyStateChange(from.rootDir, stateChangeInfo1, from.metaHandlers, {needConfirm});
    }
    if (stateChangeInfo2.stateChange.isNeedAction) {
      await applyStateChange(to.rootDir, stateChangeInfo2, to.metaHandlers, {needConfirm});
    }
    return await syncUpAssetsBetweenDir(from, to);
  }
  const allActions = await getActionForSyncUpFiles(
    {assetInfoList: stateChangeInfo1.assetInfoListMeta, rootDir: from.rootDir},
    {assetInfoList: stateChangeInfo2.assetInfoListMeta, rootDir: to.rootDir}
  );
  const fromMetaKey = from.metaHandlers.getMetaLocation();
  const toMetaKey = to.metaHandlers.getMetaLocation();
  if (!needActionToAssetsAndMeta(allActions)) {
    logColorful({color: 'red'}, `No syncUpAssetsBetweenDir action between ${fromMetaKey} and ${toMetaKey}`);
    return true;
  }
  const logFile = getPathWithDtSuffix(path.join(getMetaDir(from.rootDir), 'sync-up-assets.ts'));
  fs.writeFileSync(
    logFile,
    `export const target='${toMetaKey}';\nexport const action=${JSON.stringify(allActions, null, 2)}`
  );

  logColorful(
    {color: 'red'},
    'syncUpAssetsBetweenDir actions from',
    fromMetaKey,
    'to',
    toMetaKey,
    'is saved to file',
    logFile
  );
  if (needConfirm) {
    await goOnOrNot({
      tips: ['please go through log file and make sure whether continue of not'],
      style: {color: 'red'},
      defaultValue: true,
    });
  }
  await doActionsToAssetsAndMeta(to.rootDir, allActions, to.metaHandlers);
}
