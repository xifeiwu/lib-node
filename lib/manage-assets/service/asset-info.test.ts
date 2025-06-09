import path from 'path';
import {getAssetInfo, getSha1AsId} from './asset-info';
import { logColorful } from '../external';

export async function runGetSha1Info() {
  const fullPath = path.join(process.env.HOME, 'Documents', 'book/HTTP权威指南[7rkqcO].pdf');
  const {sha1, shortId} = await getSha1AsId(fullPath);
  logColorful({}, sha1, shortId);
}

export async function runGetAssetInfo() {
  const relativePath = 'book/HTTP权威指南[7rkqcO].pdf';
  const rootDir = path.join(process.env.HOME, 'Documents');
  const assetInfo = await getAssetInfo({rootDir, relativePath});
  logColorful({}, assetInfo);
}
