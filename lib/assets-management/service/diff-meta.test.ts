import {logColorful} from '../external';
import {readMetaFromDir} from './assets-meta';
import {diffMetaForSyncUp} from './diff-meta';

const rootDir = '/Volumes/ssd_4t/z-movie';
const bkrootDir = '/Volumes/12T_APFS/z-movie';
export async function testDiffMetaForSyncUp() {
  let sourceMeta = readMetaFromDir(rootDir);
  let bkMeta = readMetaFromDir(bkrootDir);
  let result = await diffMetaForSyncUp(bkMeta, sourceMeta);
  logColorful({}, result);
}
