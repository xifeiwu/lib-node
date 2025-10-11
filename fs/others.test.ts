import fs from 'fs';
import path from 'path';
import { isFileExist, linkFile } from './others';
export async function testLink() {
  const stat = fs.statSync(__filename);
  const lstat = isFileExist(__filename);
  const linkFileName = 'ln_other.ts';
  const linkResult = linkFile(__filename,linkFileName )
  const lstat2 = isFileExist(path.resolve());

}
