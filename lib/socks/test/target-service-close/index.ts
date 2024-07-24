import path from 'path';
import {spawnTsFile, waitFor} from '../../external';

/**
 * Check what happened when target service stopped
 */
export async function start() {
  const {pid} = spawnTsFile(path.resolve(__dirname, 'service.ts'), {
    spawnOptions: {stdio: [0, 1, 2]},
  });
  await waitFor(2000);
  spawnTsFile(path.resolve(__dirname, 'socks.ts'), {
    spawnOptions: {stdio: [0, 1, 2]},
  });
  await waitFor(2000);
  process.kill(pid);
}
