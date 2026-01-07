import path from 'path';
import {logColorful, getAFreePort, spawnAndTryIpc, getSpawnAndIpcConfigByScript} from '../../index';
import {CP} from '../../types';

export async function runDebugServerCluster() {
  const port = await getAFreePort(4000);
  const moreArgs = ['runTDebugServerCluster'];
  const spawnConfig = getSpawnAndIpcConfigByScript(path.join(__dirname, 'debug-server-cluster.ts'), {
    params: moreArgs,
    spawnOptions: {
      stdio: ['ipc', 'ignore', 'ignore'],
    },
    infoToCp: {
      config: {
        port,
        slaveCount: 2,
      },
      spawnConfig: {
        command: 'ts-node',
        args: moreArgs,
        spawnOptions: {
          stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
        },
        infoToCp: {},
      },
    },
  });
  const {responseFromCp, childProcess} = await spawnAndTryIpc<
    CP.DebugServerClusterConfig,
    CP.DebugServerClusterResponse
  >(spawnConfig);
  // childProcess.stdout.pipe(process.stdout);
  logColorful({}, {spawnConfig, responseFromCp});
}
