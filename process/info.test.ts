import assert from 'assert';
import {getProcessInfo, killProcessByPid} from './info';
import {runTsScriptInChildProcess} from './run-child-process';
import {logColorful} from '../log';

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

export async function testGetProcessInfoList() {
  const processList = await getProcessInfo();
  console.log(processList);
}

export async function testFilterByPid() {
  const pid = '40302';
  const infoListByPid = await getProcessInfo({filter: {pid: pid as unknown as number}});
  logColorful({}, infoListByPid);
}

export async function testKillProcessByPid() {
  const {pidToInfo, infoList: processList} = await getProcessInfo({
    filter: {
      command: 'testFilterProcessInfo',
    },
  });
  await killProcessByPid(
    processList.map(it => it.pid),
    {pidToInfo, doubleConfirm: true}
  );
}
// export async function testKillProcessByPort() {
//   const childProcess = spawnTsFile(path.resolve(__dirname, './start-server.ts'), {
//     printCommand: true,
//     spawnOptions: {
//       stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
//     },
//   });
//   const {port} = await new Promise<{port: number}>(res => {
//     childProcess.on('spawn', () => {
//       console.log('onSpawn');
//       childProcess.once('message', message => {
//         console.log('onMessage');
//         console.log(message);
//         res(message as {port: number});
//       });
//     });
//   });
//   console.log(`port: ${port}`);
//   {
//     const {statusCode, data} = await requestAndGetResponseInfo(
//       {
//         url: `http://127.0.0.1:${port}`,
//       },
//       {
//         dataType: 'string',
//       }
//     );
//     assert(statusCode === 200);
//     assert(data === 'hello');
//   }
//   const processInfoList = await getProcessInfoByPort(port);
//   await selectProcessToKill(processInfoList, {selectProcessToKill: true});
//   try {
//     const {statusCode} = await requestAndGetResponseInfo(
//       {
//         url: `http://127.0.0.1:${port}`,
//       },
//       {
//         dataType: 'string',
//       }
//     );
//     console.log(statusCode);
//     assert.fail(`the server should be closed`);
//   } catch (err) {
//     assert.ok(`should arrive here`);
//   }
// }
