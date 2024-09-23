import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {CP} from '../../types';
import {fromBuffer, getSpawnConfigByScriptName, logColorful, spawnAndTryIpc} from '../../index';

export async function runEmptyDaemon() {
  const spawnConfig4Daemon = getSpawnConfigByScriptName('daemon.ts', {
    args: ['runEmptyDaemon'],
    infoToCp: {},
    spawnOptions: {stdio: ['ipc']},
  });
  const {childProcess, responseFromCp} = await spawnAndTryIpc<CP.DaemonConfig, CP.DaemonInfo>(
    spawnConfig4Daemon
  );
  logColorful({}, responseFromCp);
  const {socketPath} = responseFromCp;
  const {pid} = await new Promise<CP.DaemonInfo>((res, rej) => {
    const client = net.createConnection(socketPath);
    client.on('data', chunk => {
      res(fromBuffer(chunk, 'json') as CP.DaemonInfo);
    });
    client.on('error', err => {
      rej(err);
    });
  });
  assert.equal(pid, childProcess.pid);
  childProcess.kill();
  fs.unlinkSync(socketPath);
}
