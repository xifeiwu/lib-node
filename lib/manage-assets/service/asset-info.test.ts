import path from 'path';
import {getAssetInfo, getSha1AsId} from './asset-info';
import { logColorful } from '../external';
// import {logColorful} from '../../service/external';

export async function runGetSha1Info() {
  const fullPath = path.join(process.env.HOME, 'Documents', 'book/HTTP权威指南[7rkqcO].pdf');
  const {id, shortId} = await getSha1AsId(fullPath);
  logColorful({}, id, shortId);
}

export async function runGetAssetInfo() {
  const relativePath = 'book/HTTP权威指南[7rkqcO].pdf';
  const rootDir = path.join(process.env.HOME, 'Documents');
  const assetInfo = await getAssetInfo({rootDir, relativePath});
  logColorful({}, assetInfo);
}
