import path from 'path';
import {createDuplicateFile, createNewFiles, createLinkFile, removeDataDir} from '../file-generator';
import {
  assetInfoTreeToList,
  deleteItemFromAssetTree,
  getAssetFullInfoTreeMeta,
  isSameAssetMeta,
  toAssetTreeMeta,
} from './assets-meta';
import {logColorful} from '../external';

const rootDir = path.join(__dirname, '.tmp');

export async function initAsset() {
  removeDataDir({rootDir});
  // const existingFiles = syncUpExistingFiles({rootDir});
  //a10, a20, a30, a40, a50
  createNewFiles({rootDir, folder: 'a', count: 5});
  // a11
  createDuplicateFile({rootDir, folder: 'a', referName: 10});
  // b10, b20
  createNewFiles({rootDir, folder: 'b', count: 2});
  /** create link file a30 to a30 */
  createLinkFile({rootDir, folder: 'a', sourceIndex: 30, targetName: 'a30'});
}

/**
 * Get dir asset meta
 * asset info of link file can be calculated from the source file
 */
export async function runGetDirAssetMeta() {
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
