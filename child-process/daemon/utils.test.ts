import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {DaemonConfig, DaemonResponse, spawnScript} from '../run-script';
import {logColorful, fromBuffer} from '../../index';

export async function runDaemon() {
  const {childProcess, responseFromCp} = await spawnScript<DaemonConfig, DaemonResponse>('daemon.ts', {
    waitFirstIpc: true,
    spawnOptions: {
      stdio: ['ipc'],
    },
  });
  logColorful({}, responseFromCp);
  const {socketPath} = responseFromCp;
  const {pid} = await new Promise<DaemonResponse>((res, rej) => {
    const client = net.createConnection(socketPath);
    client.on('data', chunk => {
      res(fromBuffer(chunk, 'json') as DaemonResponse);
    });
    client.on('error', err => {
      rej(err);
    });
  });
  assert.equal(pid, childProcess.pid);
  childProcess.kill();
  fs.unlinkSync(socketPath);
}
