import {ActionToAssetsAndMeta, AssetInfoFull, AssetStateChangeInfo, MetaHandlers} from '../../types';
import {doActionsToAssetsAndMeta, getAssetsPartailInfoListOfDir} from '../../service';
import {diffAssetInfoList} from './service';
import {logColorful, goOnOrNot} from '../../external';

export async function getAssetStateChange(metaHandlers: MetaHandlers) {
  const {rootDir} = metaHandlers;
  let assetInfoListMeta: AssetInfoFull[] = await metaHandlers.getAllItems();
  let latestAssetInfoList: AssetInfoFull[] = await getAssetsPartailInfoListOfDir(rootDir);
  return {
    assetInfoListMeta,
    latestAssetInfoList,
    stateChange: await diffAssetInfoList(assetInfoListMeta, latestAssetInfoList, {rootDir}),
  };
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
          asset: it,
        },
      };
    }),
    ...[...copied, ...modified].map(it => {
      const {from, to} = it;
      return {
        from: {
          rootDir,
          asset: from,
        },
        to: {
          rootDir,
          asset: to,
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
          asset: to,
        },
      };
    })
  );
  allActions.deleteFiles.push(...deleted.map(it => it.relativePath));

  await doActionsToAssetsAndMeta(rootDir, allActions, metaHandlers, {notChangeAsset: true});
}

async function syncUpAssetsChangeToMeta(
  metaHandlers: MetaHandlers,
  options?: {
    needConfirm?: boolean;
  }
) {
  const {needConfirm} = options ?? {};
  const stateChangeInfo = await getAssetStateChange(metaHandlers);
  if (!stateChangeInfo.stateChange.isNeedAction) {
    return true;
  }
  if (needConfirm) {
    logColorful({}, stateChangeInfo.stateChange);
    await goOnOrNot({
      tips: [`Are you sure to apply state change above?`],
      style: {color: 'red'},
      defaultValue: true,
    });
  }
  await applyStateChange(stateChangeInfo, metaHandlers);
  return true;
}

export async function makeSureMetaIsUptodate(
  metaHandlers: MetaHandlers,
  options?: {
    needConfirm?: boolean;
  }
) {
  const {haveMeta, resetMeta} = metaHandlers;
  if (!haveMeta) {
    await resetMeta();
  } else {
    return await syncUpAssetsChangeToMeta(metaHandlers, options);
  }
}
