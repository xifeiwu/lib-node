import fs from 'fs';
import path from 'path';
import {makeSureMetaIsUptodate} from '../assets-meta';
import {getPathWithDtSuffix, goOnOrNot, logColorful} from '../../external';
import {ActionOptions, MetaHandlers} from '../../types';
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
      return {
        sourceCanDelete: Boolean(deleted),
        action: {
          from: {
            rootDir: to.rootDir,
            asset: asset,
          },
          to: {
            rootDir: to.rootDir,
            relativePath,
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
          relativePath,
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
  const deleteFiles: Array<AssetInfoFull> = pathOnlyIn2
    .filter(it => !filesToMove.includes(it))
    .map(p => {
      return pathToInfo2[p];
    });

  return {copyFiles, deleteFiles, moveFiles};
}

export async function syncUpAssetsBetweenDir(
  from: {metaHandlers: MetaHandlers},
  to: {metaHandlers: MetaHandlers},
  options?: ActionOptions
) {
  const {needConfirm = true, logging} = options ?? {};
  const {metaHandlers: metaHandlers1} = from;
  const {metaHandlers: metaHandlers2} = to;
  await makeSureMetaIsUptodate(metaHandlers1, options);
  await makeSureMetaIsUptodate(metaHandlers2, options);

  const allActions = await getActionForSyncUpFiles(
    {assetInfoList: await metaHandlers1.getItemList(), rootDir: metaHandlers1.rootDir},
    {assetInfoList: await metaHandlers2.getItemList(), rootDir: metaHandlers2.rootDir}
  );
  const fromMetaKey = metaHandlers1.getMetaLocation();
  const toMetaKey = metaHandlers2.getMetaLocation();
  if (!needActionToAssetsAndMeta(allActions)) {
    logColorful(
      {color: 'red'},
      `No syncUpAssetsBetweenDir actions are needed between ${fromMetaKey} and ${toMetaKey}`
    );
    return true;
  }
  const logFile = getPathWithDtSuffix(path.join(getMetaDir(metaHandlers1.rootDir), 'sync-up-assets.ts'));
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
  await doActionsToAssetsAndMeta(allActions, metaHandlers2, options);
}
