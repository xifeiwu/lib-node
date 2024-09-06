import assert from 'assert';
import {getProcessInfo, getProcessInfoByPort, killProcessByPid} from './info';
import {DebugServerResponse, runTsScriptInChildProcess} from './run-child-process';
import {logColorful} from '../log';
import {isNumber} from '../fe';

export async function testFilterProcessInfo() {
  const {command, params, spawnOptions, pid} = await runTsScriptInChildProcess('debug-server', {
    args: ['testFilterProcessInfo'],
  });
  logColorful({}, {command, params, spawnOptions});
  const {infoList: infoListByPid} = await getProcessInfo({filter: {pid}});
  const {infoList: infoListByCmd} = await getProcessInfo({filter: {command: 'testFilterProcessInfo'}});
  assert.equal(infoListByPid.length, 1);
  assert.equal(infoListByPid[0].pid, pid);
  assert.deepEqual(infoListByPid[0].pid, infoListByCmd[0].pid);
}

export async function testGetProcessInfo() {
  const processList = await getProcessInfo();
  console.log(processList);
}

export async function testGetProcessInfoWithFilter() {
  const pid = '40302';
  const infoListByPid = await getProcessInfo({filter: {pid: pid as unknown as number}});
  logColorful({}, infoListByPid);
}

export async function testKillProcess() {
  const {pidToInfo, infoList: processList} = await getProcessInfo({
    filter: {
      // command: 'testFilterProcessInfo',
      pid: 35966,
    },
  });
  const success = await killProcessByPid(
    processList.map(it => it.pid),
    {pidToInfo, doubleConfirm: true}
  );
  logColorful({color: 'red'}, success ? 'Success' : 'Fail');
}

export async function testKillProcessByPort() {
  const {pid, childProcessResponse} = await runTsScriptInChildProcess<DebugServerResponse>('debug-server', {
    spawnOptions: {
      stdio: ['ipc', 'ignore', 'ignore'],
    },
  });
  if (!childProcessResponse) {
    throw new Error(`childProcessResponse is null`);
  }
  const {port} = childProcessResponse;
  assert(isNumber(port));
  const processInfoList = await getProcessInfoByPort(port);
  const success = await killProcessByPid(
    processInfoList.map(it => it.pid),
    {doubleConfirm: true, killChildren: false}
  );
  assert.equal(success, true);
  assert.equal((await getProcessInfo({filter: {pid}})).infoList.length, 0);
}
