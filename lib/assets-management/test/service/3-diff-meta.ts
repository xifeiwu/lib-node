import {logColorful} from '../external';
import {initSampleAssets, updateSourceAssets} from '../file-generator';
import {getAssetFullInfoTreeMeta, readMetaFromDir} from '../service/assets-meta';
import {diffMetaForSyncUp} from '../service/diff-meta';
import {AssetMeta} from '../types';
import {SOURCE_DIR} from './serivice';
export async function testDiffMetaForSyncUp() {
  const rootDir = SOURCE_DIR;
  initSampleAssets(rootDir);
  const sourceMeta: AssetMeta = await getAssetFullInfoTreeMeta(rootDir, {
    getAssetInfoParams: {
      reCalcId: true,
    },
  });
  updateSourceAssets(rootDir);
  const targetMeta: AssetMeta = await getAssetFullInfoTreeMeta(rootDir, {
    getAssetInfoParams: {
      reCalcId: true,
    },
  });
  // const bkrootDir = '/Volumes/12T_APFS/z-movie';
  // let sourceMeta = readMetaFromDir(rootDir);
  // let bkMeta = readMetaFromDir(bkrootDir);
  let result = await diffMetaForSyncUp(sourceMeta, targetMeta);
  logColorful({}, result);
}

export async function testDiffMetaForSyncUp2() {
  const rootDir = '/Volumes/ssd_4t/z-movie';
  const bkrootDir = '/Volumes/12T_APFS/z-movie';
  let sourceMeta = readMetaFromDir(rootDir);
  let bkMeta = readMetaFromDir(bkrootDir);
  let result = await diffMetaForSyncUp(bkMeta, sourceMeta);
  logColorful({}, result);
}
