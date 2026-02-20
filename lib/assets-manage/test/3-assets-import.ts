import path from 'path';
import {alignMetaWithAssets} from '../meta-handler';
import {getDirMetaHandler} from '../service';
import {DIR_TMP_DATA} from './service/config';
import { importAssets } from '../meta-handler/3-assets-import';

// const rootDir = '/Volumes/ssd_4t/z-movie';
// const importFromDir = process.env.HOME + '/Downloads';

const rootDir = '/Volumes/ssd_4t/camera';
const importFromDir = '/Volumes/HIKSEMI/xl-photo/';

// path.resolve(DIR_TMP_DATA, '../.tmp-bak')

export async function runImportAssets() {
  const metaHandlers = await getDirMetaHandler(rootDir);
  await metaHandlers.getMeta();
  await alignMetaWithAssets(metaHandlers);
  const newAssetsMetaHandlers = await getDirMetaHandler(importFromDir);
  await newAssetsMetaHandlers.getMeta();
  await alignMetaWithAssets(newAssetsMetaHandlers);
  await importAssets(metaHandlers, newAssetsMetaHandlers, {newAssetsDir: 'xl-photo'});
}
