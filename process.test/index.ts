import http from 'http';
import path from 'path';
import assert from 'assert';
import {getAllProcessInfo, getProcessInfoByPort, selectProcessToKill, spawnTsFile} from '../process';
import {requestAndGetResponseInfo} from '../http';
// import {resData} from './start-server';

export async function testGetAllProcessInfo() {
  const processList = await getAllProcessInfo();
  console.log(processList);
}
export async function testGetFilteredProcessInfo() {
  const processList = await getAllProcessInfo({
    filter: it => {
      return it.args.indexOf('v18.12') > -1;
    },
  });
  console.log(processList);
}

export async function testKillProcessByPort() {
  const childProcess = spawnTsFile(path.resolve(__dirname, './start-server.ts'), {
    printCommand: true,
    spawnOptions: {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    },
  });
  const {port} = await new Promise<{port: number}>(res => {
    childProcess.on('spawn', () => {
      console.log('onSpawn');
      childProcess.once('message', message => {
        console.log('onMessage');
        console.log(message);
        res(message as {port: number});
      });
    });
  });
  console.log(`port: ${port}`);
  {
    const {statusCode, data} = await requestAndGetResponseInfo(
      {
        url: `http://127.0.0.1:${port}`,
      },
      {
        dataType: 'string',
      }
    );
    assert(statusCode === 200);
    assert(data === 'hello');
  }
  const processInfoList = await getProcessInfoByPort(port);
  await selectProcessToKill(processInfoList, {selectProcessToKill: true});
  try {
    const {statusCode} = await requestAndGetResponseInfo(
      {
        url: `http://127.0.0.1:${port}`,
      },
      {
        dataType: 'string',
      }
    );
    console.log(statusCode);
    assert.fail(`the server should be closed`);
  } catch (err) {
    assert.ok(`should arrive here`);
  }
}
