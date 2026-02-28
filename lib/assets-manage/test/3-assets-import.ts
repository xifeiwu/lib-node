import path from 'path';
import {alignMetaWithAssets} from '../meta-handler';
import {getFileMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';
import {importAssets} from '../meta-handler/3-assets-import';

// const rootDir = '/Volumes/ssd_4t/z-movie';
// const importFromDir = process.env.HOME + '/Downloads';

// const rootDir = '/Volumes/ssd_4t/camera';
// const importFromDir = '/Volumes/HIKSEMI/xl-photo/';

const rootDir = '/Volumes/ssd_4t/camera';
const importFromDir = '/Volumes/ssd_4t/ruby';

// path.resolve(DIR_TMP_DATA, '../.tmp-bak')

export async function runImportAssets() {
  const metaHandlers = await getFileMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const newAssetsMetaHandlers = await getFileMetaHandler(importFromDir);
  await newAssetsMetaHandlers.getMeta();
  await alignMetaWithAssets(newAssetsMetaHandlers);
  await importAssets(metaHandlers, newAssetsMetaHandlers, {newAssetsDir: 'xl-photo'});
}
