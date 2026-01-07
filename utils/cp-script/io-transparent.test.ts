import path from 'path';
import {spawnScript} from '../../../child-process/spawn';
import {logColorful} from '../../log';

export async function run() {
  const {childProcess, spawnConfig, wholeScript} = await spawnScript(
    path.join(__dirname, 'io-transparent.ts'),
    {
      spawnOptions: {
        stdio: [0, 1, 2],
      },
    }
  );
  logColorful({}, childProcess.pid, wholeScript);
}
