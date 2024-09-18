import fs from 'fs';
import path from 'path';
import {socketDir, socketFileSuffix} from './service';
import {getFileList, startSocketClient} from '../../index';

export async function cleanUpZombieSocketPath(dirname?: string) {
  dirname = dirname ?? socketDir;
  if (!fs.existsSync(dirname)) {
    throw new Error(`dir ${dirname} not exist`);
  }
  const socketFullPathList = getFileList(dirname, {
    fileFilter({basename}) {
      return basename.endsWith(socketFileSuffix);
    },
  }).map(relativePath => path.join(dirname, relativePath));
  const active: string[] = [];
  const deactive: string[] = [];
  for (const socketPath of socketFullPathList) {
    try {
      await startSocketClient(socketPath);
      active.push(socketPath);
    } catch (err) {
      fs.unlinkSync(socketPath);
      deactive.push(socketPath);
    }
  }
  return {active, deactive};
}
