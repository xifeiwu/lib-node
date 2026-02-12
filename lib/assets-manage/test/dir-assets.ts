import path from 'path';
import {createDuplicateFile, createNewFiles, createLinkFile, removeDataDir} from './generator';

const rootDir = path.join(__dirname, '.tmp');

export async function initAsset() {
  removeDataDir(rootDir);
  // const existingFiles = syncUpExistingFiles(rootDir);
  //a10, a20, a30, a40, a50
  createNewFiles(rootDir, 'a', 5);
  // a11
  createDuplicateFile(rootDir, 'a', 10);
  // b10, b20
  createNewFiles(rootDir, 'b', 2);
  createLinkFile(rootDir, 'a', 30, 'a30');
}
