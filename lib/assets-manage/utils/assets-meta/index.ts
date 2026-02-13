import fs from 'fs';
import path from 'path';
import {
  ActionOptions,
  ActionToAssetsAndMeta,
  AssetInfoFull,
  AssetStateChangeInfo,
  MetaHandlers,
} from '../../types';
import {doActionsToAssetsAndMeta, getAssetsPartailInfoListOfDir, getMetaDir} from '../../service';
import {diffAssetInfoList, getActionToMetaByStateChange} from './service';
import {logColorful, goOnOrNot, addDtSuffixToBareBasename, makeSureDirExistForFile} from '../../external';
import {DIR_ASSET_MANAGE_TMP_DIR} from '../../service/config';

export async function getAssetStateChange(metaHandlers: MetaHandlers) {
  const {rootDir} = metaHandlers;
  let assetInfoListMeta: AssetInfoFull[] = await metaHandlers.getAllItems();
  /** only get partial asset info to reduce cost */
  let latestAssetInfoList: AssetInfoFull[] = await getAssetsPartailInfoListOfDir(rootDir);
  return {
    assetInfoListMeta,
    latestAssetInfoList,
    stateChange: await diffAssetInfoList(assetInfoListMeta, latestAssetInfoList, {rootDir}),
  };
}

export async function alignMetaWithAssets(
  metaHandlers: MetaHandlers,
  options?: {
    tmpDir?: string;
  }
) {
  const {tmpDir = DIR_ASSET_MANAGE_TMP_DIR} = options ?? {};
  const {stateChange} = await getAssetStateChange(metaHandlers);
  if (!stateChange.isNeedAction) {
    return true;
  }
  const action = getActionToMetaByStateChange(stateChange);
  const stateFile = addDtSuffixToBareBasename(path.join(tmpDir, 'align-meta-with-assets.ts'));
  makeSureDirExistForFile(stateFile);
  fs.writeFileSync(stateFile, JSON.stringify({stateChange, action}, null, 2));
  if (
    !(await goOnOrNot({
      tips: [`state change is saved to file: ${stateFile}`, `Are you sure to apply state change above?`],
      style: {color: 'red'},
      defaultValue: true,
    }))
  ) {
    return false;
  }
  const {toAdd, toDelete, toModify} = action;
  await metaHandlers.createItems(toAdd);
  await metaHandlers.updateItems(toModify.map(it => ({info: it.to, prevInfo: it.from})));
  await metaHandlers.removeItems(toDelete.map(it => it.relativePath));
  return true;
}

export async function applyStateChange(
  stateChangeInfo: AssetStateChangeInfo,
  metaHandlers: MetaHandlers,
  options?: {
    needConfirm?: boolean;
  }
) {
  const {rootDir, getMetaLocation} = metaHandlers;
  const {needConfirm = false} = options ?? {};
  const {stateChange} = stateChangeInfo;
  if (needConfirm) {
    logColorful({}, stateChange);
    await goOnOrNot({
      tips: [`Will apply these state change to asset meta(${getMetaLocation()})`],
      style: {color: 'red'},
      defaultValue: true,
    });
  }
  if (!stateChange.isNeedAction) {
    return false;
  }
  const {added = [], copied = [], moved = [], modified = [], deleted = []} = stateChange;
  const allActions: ActionToAssetsAndMeta = {copyFiles: [], moveFiles: [], deleteFiles: []};
  allActions.copyFiles.push(
    ...added.map(it => {
      return {
        from: {
          rootDir,
          asset: it,
        },
        to: {
          rootDir,
          relativePath: it.relativePath,
        },
      };
    }),
    ...[...copied, ...modified].map(it => {
      const {from} = it;
      return {
        from: {
          rootDir,
          asset: from,
        },
        to: {
          rootDir,
          relativePath: from.relativePath,
        },
      };
    })
  );
  allActions.moveFiles.push(
    ...moved.map(it => {
      const {from, to} = it;
      return {
        from: {
          rootDir,
          asset: from,
        },
        to: {
          rootDir,
          relativePath: from.relativePath,
        },
      };
    })
  );
  allActions.deleteFiles.push(...deleted);

  await doActionsToAssetsAndMeta(allActions, metaHandlers, {notChangeAsset: true});
}

async function syncUpAssetsChangeToMeta(metaHandlers: MetaHandlers, options?: ActionOptions) {
  const {logging} = options ?? {};
  const metaKey = metaHandlers.getKey();
  const {rootDir} = metaHandlers;
  const {needConfirm} = options ?? {};
  logging && logColorful({color: 'yellow'}, `start checking assets-meta alignment for: ${metaKey}`);

  const stateChangeInfo = await getAssetStateChange(metaHandlers);
  const {stateChange} = stateChangeInfo;
  if (stateChange.isNeedAction) {
    if (needConfirm) {
      const content = JSON.stringify(stateChangeInfo.stateChange, null, 2);
      const size = Buffer.from(content).byteLength;
      if (size > 1024) {
        const logFilePath = addDtSuffixToBareBasename(path.join(getMetaDir(rootDir), 'state-change.ts'));
        fs.writeFileSync(logFilePath, content);
        logColorful({color: 'red'}, `syncUpAssetsChangeToMeta actions are saved to file`, logFilePath);
      } else {
        logColorful({color: 'red'}, `syncUpAssetsChangeToMeta actions as follows:`);
        logColorful({}, content);
      }
      await goOnOrNot({
        tips: [`Are you sure to apply state change above?`],
        style: {color: 'red'},
        defaultValue: true,
      });
    }
    await applyStateChange(stateChangeInfo, metaHandlers);
  } else {
    logging && logColorful({color: 'yellow'}, `assets-meta already aligned for ${metaKey}`);
  }
}

export async function makeSureMetaIsUptodate(metaHandlers: MetaHandlers, options?: ActionOptions) {
  const {getKey, haveMeta, resetMeta} = metaHandlers;
  options?.logging && logColorful({color: 'yellow'}, `${getKey()} hasMeta: ${haveMeta()}`);
  if (!haveMeta()) {
    options?.logging && logColorful({color: 'yellow'}, `start resetMeta for: ${getKey()}`);
    await resetMeta();
  } else {
    return await syncUpAssetsChangeToMeta(metaHandlers, options);
  }
}
