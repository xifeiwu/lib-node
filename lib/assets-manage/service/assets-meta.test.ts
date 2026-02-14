import path from 'path';
import {getAssetFullInfoTreeMeta} from './assets-meta';
import {logColorful} from '../external';
export async function runGetDirAssetMeta() {
  const rootDir = path.resolve(__dirname, '..');
  const assetInfoTree = await getAssetFullInfoTreeMeta(rootDir, {
    goThroughDirOptions: {
      maxDepth: 3,
      fileFilter({basename}) {
        return !basename.startsWith('.');
      },
      dirFilter({basename}) {
        return !basename.startsWith('.');
      },
    },
    getAssetInfoParams: {
      reCalcId: true,
    },
  });
  logColorful({}, assetInfoTree);
  // saveDirMetaToFile(rootDir, assetInfoTree);
}
