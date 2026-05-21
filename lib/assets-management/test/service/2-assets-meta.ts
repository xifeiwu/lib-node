import {
  createDuplicateFile,
  createNewFiles,
  createLinkFile,
  removeDataDir,
  initSampleAssets,
} from '../file-generator';
import {
  assetInfoTreeToList,
  deleteItemFromAssetTree,
  getAssetFullInfoTreeMeta,
  isSameAssetMeta,
  toAssetTreeMeta,
} from '../service/assets-meta';
import {logColorful} from '../external';
import {SOURCE_DIR} from './serivice';

/**
 * Get dir asset meta
 * asset info of link file can be calculated from the source file
 */
export async function runGetDirAssetMeta() {
  const rootDir = SOURCE_DIR;
  const assetInfoTree = await getAssetFullInfoTreeMeta(rootDir, {
    getAssetInfoParams: {
      reCalcId: true,
    },
  });
  logColorful({}, assetInfoTree);
  /** test convert between tree and list */
  const assetInfoList = assetInfoTreeToList(assetInfoTree);
  const newTree = toAssetTreeMeta(assetInfoList, rootDir);
  // test delete item from tree
  const deletedItme = deleteItemFromAssetTree(newTree, 'a/10.txt');
  logColorful({}, deletedItme);
  const isSame = isSameAssetMeta(assetInfoTree, newTree);
  logColorful({}, isSame);
}
