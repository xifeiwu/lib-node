import {
  createDuplicateFile,
  createLinkFile,
  createNewFiles,
  deleteFile,
  removeDataDir,
  syncUpExistingFiles,
  updateFileContent,
} from '.';
import {logColorful} from '../external';

export function initSampleAssets(rootDir: string) {
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

/**
 * update source assets
 * create a new file a60
 * create a duplicate file a12
 * delete a file a40
 * update a file content
 * @param rootDir
 */
export function updateSourceAssets(rootDir: string) {
  const existingFiles = syncUpExistingFiles({rootDir});
  logColorful({}, existingFiles);
  /** create a new file a60 */
  createNewFiles({rootDir, folder: 'a', count: 1});
  /** create a duplicate file a12 */
  createDuplicateFile({rootDir, folder: 'a', referName: 10});
  /** delete a file a40 */
  deleteFile({rootDir, folder: 'a', index: 40});
  /** update a file content */
  updateFileContent({rootDir, folder: 'a', index: 50});
}
