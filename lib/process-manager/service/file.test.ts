import path from 'path';
import assert from 'assert';
import fs from 'fs';
import {getAFreePort} from '../../../net/service/utils';
import {logColorful, getSpawnConfigByScript, CP, waitFor, killProcessByPid} from './external';
import {launchCpInDetachedMode} from '../launch-cp/detached';
import {getAllCpKeyInfo, getCpBaseDir} from './file';

/**
 * Same style as {@link ../launch-cp/detached.test.ts runDetachedDebugServer}: launch a detached cp, then assert
 * {@link getAllCpKeyInfo} returns a row for that `cpId`.
 */
export async function testGetAllCpKeyInfo() {
  const cpId = `test-get-all-cp-key-${Date.now()}`;
  const debugServerScript = path.resolve(__dirname, '../../../utils/cp-script/debug-server.ts');
  const port = await getAFreePort(4000);
  const launched = await launchCpInDetachedMode({
    id: cpId,
    spawnConfig: getSpawnConfigByScript<CP.DebugServerConfig>(debugServerScript, {
      params: [cpId],
      infoToCp: {port},
      maxWaitTime4Ipc: 15,
    }),
  });
  const childPid = launched.spawn.pid;
  assert.ok(childPid && childPid > 0, 'launch should expose child pid');

  await waitFor(1000);

  const list = await getAllCpKeyInfo();
  assert.ok(Array.isArray(list), 'getAllCpKeyInfo returns an array');
  const mine = list.find(it => it && it.key === cpId);
  assert.ok(mine, `expected a CpKeyInfo row for cpId=${cpId}`);
  assert.equal(mine!.key, cpId);
  assert.equal(mine!.pid, childPid);
  assert.ok(mine!.command.includes('debug-server'), mine!.command);
  assert.ok(mine!.outFilePath.includes(cpId), mine!.outFilePath);
  assert.ok(mine!.errFilePath.includes(cpId), mine!.errFilePath);
  logColorful({}, 'getAllCpKeyInfo match:', mine);

  const base = getCpBaseDir(cpId);
  try {
    await killProcessByPid([childPid], {killChildren: false});
  } catch {
    /* ignore */
  }
  await waitFor(400);
  if (fs.existsSync(base)) {
    fs.rmSync(base, {recursive: true, force: true});
  }
}
