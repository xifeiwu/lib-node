import {createDuplicateFile, createNewFiles, createLinkFile, removeDataDir} from './generator';
import {
  assetInfoTreeToList,
  deleteItemFromAssetTree,
  getAssetFullInfoTreeMeta,
  isSameAssetMeta,
  toAssetTreeMeta,
} from '../service';
import {logColorful} from '../../../log';

// const rootDir = DIR_TMP_DATA;
// const rootDir = path.resolve(process.env.HOME, 'Downloads');
const rootDir = '/Volumes/ssd_4t/z-movie';

export async function initAsset() {
  removeDataDir(rootDir);
  // const existingFiles = syncUpExistingFiles(rootDir);
  //a10, a20, a30, a40, a50
  createNewFiles(rootDir, 'a', 5);
  // a11
  createDuplicateFile(rootDir, 'a', 10);
  // b10, b20
  createNewFiles(rootDir, 'b', 2);
  /** create link file a30 to a30 */
  createLinkFile(rootDir, 'a', 30, 'a30');
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
  // logColorful({}, newTree);
  // diffAssets
}
