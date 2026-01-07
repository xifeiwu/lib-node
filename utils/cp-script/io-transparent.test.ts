import path from 'path';
import {spawnScriptAndTryIpc} from '../../child-process/spawn';
import {logColorful} from '../../log';

export async function run() {
  const {childProcess, wholeScript} = await spawnScriptAndTryIpc(path.join(__dirname, 'io-transparent.ts'), {
    spawnOptions: {
      stdio: [0, 1, 2],
    },
  });
  logColorful({}, childProcess.pid, wholeScript);
}
