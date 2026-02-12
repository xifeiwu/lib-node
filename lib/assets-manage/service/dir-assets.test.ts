import path from 'path';
import {getAssetFullInfoTreeOfDir} from './dir-assets';
import {logColorful} from '../external';
export async function runGetDirAssetMeta() {
  const rootDir = path.resolve(__dirname, '..');
  const assetInfoTree = await getAssetFullInfoTreeOfDir(rootDir, {
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
