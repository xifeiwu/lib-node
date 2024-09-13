import fs from 'fs';
import path from 'path';
import {socketDir, socketFileSuffix} from './service';
import {getFileList, startSocketClient} from '../../index';

export async function cleanUpZombieSocketPath(dirname?: string) {
  dirname = dirname ?? socketDir;
  if (!fs.existsSync(dirname)) {
    throw new Error(`dir ${dirname} not exist`);
  }
  const socketFileList = getFileList(dirname, {
    fileFilter({basename}) {
      return basename.endsWith(socketFileSuffix);
    },
  });
  const active: string[] = [];
  const deactive: string[] = [];
  for (const socketFile of socketFileList) {
    try {
      await startSocketClient(socketFile);
      active.push(socketFile);
    } catch (err) {
      fs.unlinkSync(path.join(dirname, socketFile));
      deactive.push(socketFile);
    }
  }
  return {active, deactive};
}
