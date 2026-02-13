import path from 'path';
import {createDuplicateFile, createNewFiles, createLinkFile, removeDataDir} from './generator';
import {getAssetFullInfoTreeOfDir} from '../service/dir-assets';
import {logColorful} from '../../../log';
import {DIR_TMP_DATA} from './service/config';
import {getDirMetaHandler} from '../service';

const rootDir = DIR_TMP_DATA;

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
  const assetInfoTree = await getAssetFullInfoTreeOfDir(rootDir, {
    getAssetInfoParams: {
      reCalcId: true,
    },
  });
  logColorful({}, assetInfoTree);
}

export async function testGetDirMetaHandler() {
  const metaHandlers = await getDirMetaHandler(DIR_TMP_DATA);
  await metaHandlers.checkMeta();
}
