import fs from 'fs';
import path from 'path';

export function writeFileSync(fullPath: string, data: string | NodeJS.ArrayBufferView) {
  const dirName = path.dirname(fullPath);
  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, {recursive: true});
  }
  fs.writeFileSync(fullPath, data);
}

export function isInSameDevice(fullPath1: string, fullPath2: string) {
  try {
    const stat1 = fs.statSync(fullPath1);
    const stat2 = fs.statSync(fullPath2);
    return stat1.dev === stat2.dev;
  } catch (err) {
    return false;
  }
}

export function moveFile(fromPath: string, toPath: string) {
  fromPath = path.resolve(fromPath);
  toPath = path.resolve(toPath);
  if (isInSameDevice(fromPath, toPath)) {
    fs.renameSync(fromPath, fromPath);
  } else {
    fs.copyFileSync(fromPath, toPath);
    fs.unlinkSync(fromPath);
  }
}

export function recursiveDeleteFile(path: string) {
  if (fs.existsSync(path)) {
    if (fs.statSync(path).isFile()) {
      fs.unlinkSync(path);
    } else if (fs.statSync(path).isDirectory()) {
      fs.readdirSync(path).forEach((file, index) => {
        const curPath = path + '/' + file;
        if (fs.statSync(curPath).isDirectory()) {
          // recurse
          recursiveDeleteFile(curPath);
        } else {
          // delete file
          fs.unlinkSync(curPath);
        }
      });
      fs.rmdirSync(path);
    }
  } else {
    console.error(`Error: path ${path} not exist`);
  }
}
