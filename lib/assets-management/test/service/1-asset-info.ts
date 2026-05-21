import path from 'path';
import {logColorful} from '../external';
import {getAssetInfo} from '../service/asset-info';
import {SOURCE_DIR} from './serivice';

export async function runGetAssetInfo() {
  const rootDir = SOURCE_DIR;
  const relativePath = 'a/10.txt';
  const assetInfo = await getAssetInfo({rootDir, relativePath, reCalcId: true});
  logColorful({}, assetInfo);
}

export async function runGetAssetInfo2() {
  const relativePath = 'book/HTTP权威指南[7rkqcO].pdf';
  const rootDir = path.join(process.env.HOME, 'Documents');
  const assetInfo = await getAssetInfo({rootDir, relativePath});
  logColorful({}, assetInfo);
}
