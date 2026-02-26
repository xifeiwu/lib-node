import fs from 'fs';
import path from 'path';
import {makeSureMetaIsUptodate} from '../assets-meta';
import {
  appendShortIdToFilePath,
  getAssetInfoById,
  getFullAssetInfo,
  getMetaDir,
  needActionToAssetsAndMeta,
} from '../../service';
import {getOneAssetInfo, doActionsToAssetsAndMeta} from '../../service';
import {ActionOptions, ActionToAssetsAndMeta, GetAssetInfoParams, MetaHandlers} from '../../types';
import {getShortIdToAssetInfo} from '../../service';
import {AssetInfoFull, ShortIdToAssetInfo} from '../../types';
import {formatDate, getFilePathInfo, getPathWithDtSuffix, goOnOrNot, logColorful} from '../../external';

/**
 * get relative path for target dir
 * 1. save to dir new-files-${formatDate(new Date(), 'yyyy-MM-dd')}
 * 2. append shortId to avoid override
 * 3. stay basename
 * 4. There shouldn't be duplicate file if logic runs correct, as they are new file
 */
function getToRelativePath(fromAssetInfo: AssetInfoFull) {
  const {relativePath, shortId} = fromAssetInfo;
  const pathWithSuffix = appendShortIdToFilePath(relativePath, shortId);
  return `new-files-${formatDate(new Date(), 'yyyy-MM-dd')}/${getFilePathInfo(pathWithSuffix).basename}`;
}

/**
 * What should do to import new assets from dir to target dir
 * NOTICE:
 * 1. This happened cross different dirs, so use shortId as id
 * 2. Make sure assets meta is sync up with assets in dir
 * @param from
 * @param to
 */
export async function getActionForImportNewAssets(
  from: {assetInfoList: AssetInfoFull[]; rootDir: string},
  to: {assetInfoList: AssetInfoFull[]; rootDir: string}
): Promise<ActionToAssetsAndMeta> {
  const idToInfo1 = getShortIdToAssetInfo(from.assetInfoList);
  const idToInfo2 = getShortIdToAssetInfo(to.assetInfoList);
  const idAll = Array.from(new Set([...Object.keys(idToInfo1), ...Object.keys(idToInfo2)]));
  const id1Only: string[] = [];
  const id2Only: string[] = [];
  const idCommon: string[] = [];
  for (const id of idAll) {
    let cnt = 0;
    cnt |= idToInfo1[id] ? 1 : 0;
    cnt |= idToInfo2[id] ? 2 : 0;
    if (cnt === 1) {
      id1Only.push(id);
    } else if (cnt === 2) {
      id2Only.push(id);
    } else if (cnt === 3) {
      idCommon.push(id);
    } else {
      throw new Error(`id should not equal to ${id}`);
    }
  }
  const toAdd: ShortIdToAssetInfo = {};
  /** Handle asset in files but not in db */
  for (const shortId of id1Only) {
    toAdd[shortId] = getAssetInfoById(idToInfo1, shortId);
  }

  const allActions = {
    copyFiles: Object.values(toAdd).map(it => {
      const asset = getOneAssetInfo(it);
      return {
        from: {
          rootDir: from.rootDir,
          asset,
        },
        to: {
          rootDir: to.rootDir,
          relativePath: getToRelativePath(asset),
        },
      };
    }),
  };
  return allActions;
}

export async function importNewAssets(
  from: {metaHandlers: MetaHandlers},
  to: {metaHandlers: MetaHandlers},
  options?: ActionOptions
) {
  const {needConfirm = true, logging} = options ?? {};
  const {metaHandlers: metaHandlers1} = from;
  const {metaHandlers: metaHandlers2} = to;
  await makeSureMetaIsUptodate(metaHandlers1, options);
  await makeSureMetaIsUptodate(metaHandlers2, options);
  const allActions = await getActionForImportNewAssets(
    {assetInfoList: await metaHandlers1.getItemList(), rootDir: from.metaHandlers.rootDir},
    {assetInfoList: await metaHandlers2.getItemList(), rootDir: to.metaHandlers.rootDir}
  );

  const fromMetaKey = from.metaHandlers.getMetaLocation();
  const toMetaKey = to.metaHandlers.getMetaLocation();
  if (!needActionToAssetsAndMeta(allActions)) {
    logColorful(
      {color: 'red'},
      `No importNewAssets actions are needed between ${fromMetaKey} and ${toMetaKey}`
    );
    return true;
  }

  const logFile = getPathWithDtSuffix(
    path.join(getMetaDir(from.metaHandlers.rootDir), 'import-new-asset.ts')
  );
  fs.writeFileSync(
    logFile,
    `export const target='${toMetaKey}';\nexport const action=${JSON.stringify(allActions, null, 2)}`
  );
  logColorful(
    {color: 'red'},
    'importNewAssets actions from',
    fromMetaKey,
    'to',
    toMetaKey,
    `is saved to file`,
    logFile
  );
  if (needConfirm) {
    await goOnOrNot({
      tips: ['please go through log file and make sure whether continue of not'],
      style: {color: 'red'},
      defaultValue: true,
    });
  }
  await doActionsToAssetsAndMeta(allActions, to.metaHandlers);
}

export async function copyAsset(
  metaHandlers: MetaHandlers,
  filePath: string,
  options?: {actionOptions?: ActionOptions; getAssetInfoParams?: GetAssetInfoParams}
) {
  const {
    actionOptions: {needConfirm, logging} = {needConfirm: true, logging: true},
    getAssetInfoParams = {},
  } = options ?? {};
  const {getKey, rootDir: rootDir2, findItems} = metaHandlers;
  const fullPath = path.resolve(process.cwd(), filePath);
  const {dirname: rootDir1, basename: relativePath1} = getFilePathInfo(fullPath);
  const assetInfo = await getFullAssetInfo({
    ...getAssetInfoParams,
    rootDir: rootDir1,
    relativePath: relativePath1,
  });
  await makeSureMetaIsUptodate(metaHandlers, options?.actionOptions);
  logging && logColorful({color: 'blue'}, `This is info for asset ${fullPath}`, assetInfo);
  const {shortId} = assetInfo;
  const items = await findItems({shortId});
  if (items.length > 0) {
    logColorful({color: 'red'}, `This asseet already exist in meta ${getKey()}`);
    logColorful({}, items);
    return;
  }
  if (needConfirm) {
    await goOnOrNot({
      tips: [`Do you want to add file ${fullPath} to ${rootDir2} using meta ${getKey()}`],
    });
  }
  doActionsToAssetsAndMeta(
    {
      copyFiles: [
        {
          from: {
            rootDir: rootDir1,
            asset: assetInfo,
          },
          to: {
            rootDir: rootDir2,
            relativePath: getToRelativePath(assetInfo),
          },
        },
      ],
    },
    metaHandlers
  );
}
