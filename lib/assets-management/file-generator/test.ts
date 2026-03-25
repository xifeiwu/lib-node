import path from 'path';
import {initSampleAssets} from './utils';

const rootDir = path.join(__dirname, '.tmp');

export async function initAssets() {
  initSampleAssets(rootDir);
}
