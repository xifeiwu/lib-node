import {createDuplicateFile, createLinkFile, createNewFiles, removeDataDir} from '.';

export async function initSampleAssets(rootDir: string) {
  /** remove assets dir if exists */
  removeDataDir({rootDir});
  // const existingFiles = syncUpExistingFiles({rootDir});
  //a10, a20, a30, a40, a50
  createNewFiles({rootDir, folder: 'a', count: 5});
  // a11
  createDuplicateFile({rootDir, folder: 'a', referName: 10});
  // b10, b20
  createNewFiles({rootDir, folder: 'b', count: 2});
  /** create link file a30 to a30 */
  createLinkFile({rootDir, folder: 'a', sourceIndex: 30, targetName: 'a30'});
}
