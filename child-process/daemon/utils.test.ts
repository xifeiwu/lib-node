import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {getSpawnConfigByScriptName, spawnScript} from '../run-on-cp';
import {logColorful, fromBuffer} from '../../index';
import {startDetachedDaemon} from './utils';

export async function testStartDetachedDaemon() {
  const spawnConfigDebugServer = getSpawnConfigByScriptName('debug-server.ts', {
    args: [],
    spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
    infoToCp: {},
    maxWaitTime4Ipc: 10,
  });
  const spawnResponse = await startDetachedDaemon(
    {
      daemonKey: 'debug-server',
    },
    spawnConfigDebugServer
  );
  logColorful({}, spawnResponse);
}
