import {getTsParams, isObject, startHttpServer, toBuffer} from '@modules/lib/node';
import {getScriptFullpath} from '.';
import {spawn, SpawnOptions} from 'child_process';
import {out} from './service';
import {ChildProcessInfo, IpcConfig, CpServerInfo} from './types';
import {rejectError} from '@src/1-js/error/case/throw-catch';

export interface DebugServerInfo extends ChildProcessInfo, CpServerInfo {}
async function spawnDebugServer(config?: IpcConfig) {
  const {spawnOptions, args} = config;
  const scriptPath = await getScriptFullpath('debug-server.ts');
  const params = getTsParams(scriptPath);
  if (args) {
    params.push(...args);
  }
  const command = 'ts-node';
  const mergedOptions: SpawnOptions = {
    ...(spawnOptions ?? {}),
    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  };
  const childProcess = spawn(command, params, mergedOptions);
  // childProcess.on('spawn', () => {
  //   const duration = Date.now() - startTime;
  //   console.log(`start child process: ${childProcess.pid}, with duration [${duration}]`);
  // });
  return await new Promise<DebugServerInfo>((res, rej) => {
    childProcess.on('message', chunk => {
      if (!isObject(chunk)) {
        rej(chunk);
        return;
      }
      res({
        pid: childProcess.pid,
        command,
        params,
        spawnOptions: mergedOptions,
        ...(chunk as DebugServerInfo),
      });
    });
  });
}

export interface MainDebugServerInfo extends CpServerInfo {
  pid: number;
  childServerInfo: DebugServerInfo[];
}
export async function start() {
  let config: IpcConfig = {};
  if (process.send) {
    config = await new Promise<IpcConfig>(res => {
      process.on('message', (chunk: IpcConfig) => {
        // process.send(toBuffer(['ipc channel:', chunk]).toString());
        res(chunk);
      });
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  try {
    const infoList: DebugServerInfo[] = [];
    /** Start one by one to avoid port confliction */
    infoList.push(await spawnDebugServer(config));
    infoList.push(await spawnDebugServer(config));

    const {host, port, origin, server} = await startHttpServer({
      request(req, res) {
        res.setHeader('content-type', 'application/json');
        res.end(toBuffer(JSON.stringify(info)));
      },
    });
    const info: MainDebugServerInfo = {
      pid: process.pid,
      origin,
      host,
      port,
      childServerInfo: infoList,
    };
    out(info);
  } catch (err) {
    out(err);
  }
}

start();
