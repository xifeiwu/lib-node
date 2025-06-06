import {
  diffAssets,
  getAssetInfoByShortId,
  getRelativePathToAssetInfo,
  getShortIdToAssetInfo,
  toFullAssetInfo,
} from '../../service';
import {AssetInfoFull, AssetInfoPartial, DirAssetsStateChange} from '../../types';

/**
 * Get asset state changed by compare file meta with exsiting files of target dir.
 * ONLY limited to the same rootDir, so use relativePath as id
 * @param referAssetInfoList, get from dir meta file
 * @param currentAssetInfoList, get from lastest content, use AssetInfoPartial here can reduce cost.
 * @returns
 */
export async function diffAssetInfoList(
  referAssetInfoList: AssetInfoFull[],
  currentAssetInfoList: AssetInfoPartial[],
  config: {
    rootDir: string;
  }
): Promise<DirAssetsStateChange> {
  const {rootDir} = config;
  const pathToInfo1 = getRelativePathToAssetInfo(referAssetInfoList);
  const shortIdToAssetInfo1 = getShortIdToAssetInfo(referAssetInfoList);
  const pathToInfo2 = getRelativePathToAssetInfo(currentAssetInfoList as AssetInfoFull[]);

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

  const added: AssetInfoFull[] = [];
  const copied: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[] = [];
  const moved: {
    from: AssetInfoFull;
    to: AssetInfoFull;
  }[] = [];
  const modified: {
    from: AssetInfoFull;
    to: AssetInfoFull;
    changed: Partial<AssetInfoFull>;
  }[] = [];
  let deleted: AssetInfoFull[] = [];

  /**
   * All cases:
   * 1. new file
   * 2. copied from file in 1: shortId exist in file of 1
   * 3. move from file in 1:
   */
  for (const p of pathOnlyIn2) {
    const info = pathToInfo2[p];
    const fullInfo = await toFullAssetInfo(info, rootDir);
    const {shortId} = fullInfo;
    const info1 = getAssetInfoByShortId(shortIdToAssetInfo1, shortId);
    if (!info1) {
      added.push(fullInfo);
      continue;
    }
    const {relativePath} = info1;
    if (pathCommon.includes(relativePath)) {
      copied.push({
        from: info1,
        to: fullInfo,
      });
    } else if (pathOnlyIn1.includes(relativePath)) {
      moved.push({
        from: info1,
        to: fullInfo,
      });
    }
  }
  for (const p of pathCommon) {
    const info1 = pathToInfo1[p];
    const info2 = pathToInfo2[p];
    const changed = diffAssets(info2, info1);
    if (changed) {
      /** Once there are asset props change, should recalculate assets sha1 */
      const newInfo2 = await toFullAssetInfo(info2, rootDir);
      const changed2 = diffAssets(newInfo2, info1);
      if (changed2) {
        modified.push({
          from: info1,
          to: newInfo2,
          changed,
        });
      }
    }
  }

  const pathOfMovedIn1 = moved.map(it => it.from.relativePath);
  deleted = pathOnlyIn1.filter(p => !pathOfMovedIn1.includes(p)).map(p => pathToInfo1[p]);

  const isNeedAction =
    [added, copied, moved, modified, deleted].reduce<number>((sum, it) => {
      return sum + it.length;
    }, 0) > 0;
  return {
    added,
    copied,
    moved,
    modified,
    deleted,
    isNeedAction,
  };
}

export function getActionToMetaByStateChange(stateChange: DirAssetsStateChange) {
  const {added = [], copied = [], moved = [], modified = [], deleted = [], isNeedAction} = stateChange;
  const toAdd: AssetInfoFull[] = [...added, ...copied.map(it => it.to), ...moved.map(it => it.to)];
  const toDelete: AssetInfoFull[] = [...deleted, ...moved.map(it => it.from)];
  const toModify = modified;
  return {toAdd, toDelete, toModify, isNeedAction};
}
