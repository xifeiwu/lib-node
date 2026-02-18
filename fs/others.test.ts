import fs from 'fs';
import path from 'path';
import {linkFile, moveFile} from './others';
import {isFileExist} from './read';
export async function testLink() {
  const stat = fs.statSync(__filename);
  const lstat = isFileExist(__filename);
  const linkFileName = 'ln_other.ts';
  const linkResult = linkFile(__filename, linkFileName);
  const lstat2 = isFileExist(path.resolve());
}

export async function testMoveFile() {
  const filePath = path.join(process.env.HOME, 'Downloads/dd.mp4');
  if (!isFileExist(filePath)) {
    throw new Error(`file not exist: ${filePath}`);
  }
  const toPath = path.join(process.env.HOME, 'Downloads/dd.mp4');
  const start = Date.now();
  moveFile(filePath, toPath);
  const end = Date.now();
  console.log(`moveFile from ${filePath} to ${toPath} cost ${end - start}ms`);
}
