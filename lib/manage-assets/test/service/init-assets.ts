import {
  createDuplicateFile,
  createNewFile,
  createNewFiles,
  deleteFile,
  removeDataDir,
  syncUpExistingFiles,
  updateFile,
} from './util';

export async function initAsset(rootDir: string) {
  removeDataDir(rootDir);
  const existingFiles = syncUpExistingFiles(rootDir);
  //a10, a20, a30, a40, a50
  createNewFiles(rootDir, 'a', 5);
  // a11
  createDuplicateFile(rootDir, 'a', 10);
  // b10, b20
  createNewFiles(rootDir, 'b', 2);
}

export async function updateAssetsForAllCases(rootDir: string) {
  // create new file a60
  const {relativePath: fileCreated} = createNewFile(rootDir, 'a', 60);
  // delete a20
  const {relativePath: fileDeleted} = deleteFile(rootDir, 'a', 20);
  // modify a30
  const {relativePath: fileUpdated} = updateFile(rootDir, 'a', 30);
  // moved a40 to b40
  deleteFile(rootDir, 'a', 40);
  createNewFile(rootDir, 'b', 40);
  // copy a50 to b50
  createNewFile(rootDir, 'b', 50);
}

// create a new file that deleted
export async function createNewFileThatDeleted(rootDir: string) {
  createNewFile(rootDir, 'a', 20);
}
