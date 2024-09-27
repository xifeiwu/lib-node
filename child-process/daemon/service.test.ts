import fs from 'fs';
import net from 'net';
import assert from 'assert';
import {getCpConfigByScriptName, spawnScript} from '../run-on-cp';
import {logColorful, fromBuffer, CP} from '../../index';
import {getDaemonCpConfigByScriptPath, startDetachedDaemon} from './service';

const spawnDebugServer = getDaemonCpConfigByScriptPath<CP.DebugServerConfig>('debug-server.ts', {
  id: 'debug-server-1',
  infoToCp: {},
  maxWaitTime4Ipc: 20,
});

export async function testStartDetachedDaemon() {
  // const spawnConfigDebugServer = getSpawnConfigByScriptName('debug-server.ts', {
  //   args: [],
  //   spawnOptions: {stdio: ['pipe', 'pipe', 'pipe', 'ipc']},
  //   infoToCp: {},
  //   maxWaitTime4Ipc: 10,
  // });
  const spawnResponse = await startDetachedDaemon(
    {
      daemonKey: 'testStartDetachedDaemon',
      cpConfigList: [spawnDebugServer],
    },
    {debug: true}
  );
  logColorful({}, spawnResponse);
}
