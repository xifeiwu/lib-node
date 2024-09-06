import {
  getRequestHeaderInfo,
  getTsParams,
  isObject,
  startHttpServer,
  toBuffer,
  toHtml,
  toUl,
} from '../../../index';
import {getScriptFullpath, runTsScriptInChildProcess} from './service';
import {spawn, SpawnOptions} from 'child_process';
import {out} from './service';
import {
  ChildProcessInfo,
  MessageToCp,
  DebugServerResponse,
  DebugServerClusterConfig,
  DebugServerClusterResponse,
} from './types';

export interface DebugServerInfo extends ChildProcessInfo, DebugServerResponse {}
// async function spawnDebugServer(config?: MessageToCp) {
//   const {spawnOptions, args} = config;
//   const scriptPath = await getScriptFullpath('debug-server');
//   const params = getTsParams(scriptPath);
//   if (args) {
//     params.push(...args);
//   }
//   const command = 'ts-node';
//   const mergedOptions: SpawnOptions = {
//     ...(spawnOptions ?? {}),
//     stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
//   };
//   const childProcess = spawn(command, params, mergedOptions);
//   // childProcess.on('spawn', () => {
//   //   const duration = Date.now() - startTime;
//   //   console.log(`start child process: ${childProcess.pid}, with duration [${duration}]`);
//   // });
//   return await new Promise<DebugServerInfo>((res, rej) => {
//     childProcess.on('message', chunk => {
//       if (!isObject(chunk)) {
//         rej(chunk);
//         return;
//       }
//       res({
//         pid: childProcess.pid,
//         command,
//         params,
//         spawnOptions: mergedOptions,
//         ...(chunk as DebugServerInfo),
//       });
//     });
//   });
// }

export interface MainDebugServerInfo extends DebugServerResponse {
  pid: number;
  childServerInfo: DebugServerResponse[];
}
export async function start() {
  let ipcMessage: MessageToCp<DebugServerClusterConfig> = {};
  const supportIpc = Boolean(process.send);
  if (supportIpc) {
    ipcMessage = await new Promise<MessageToCp>(res => {
      process.on('message', (chunk: MessageToCp) => {
        // process.send(toBuffer(['ipc channel:', chunk]).toString());
        res(chunk);
      });
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config = {}, cpConfig = {}} = ipcMessage;
  const {slaveCount = 3, port} = config;
  try {
    const slaves: ChildProcessInfo<DebugServerResponse>[] = [];
    /** Start one by one to avoid port confliction */
    let cnt = 0;
    while (cnt++ < slaveCount) {
      slaves.push(await runTsScriptInChildProcess<DebugServerResponse>('debug-server', cpConfig));
    }

    const originToSalve = slaves.reduce((sum, slave) => {
      const {
        childProcessResponse: {host, port},
      } = slave;
      return {
        ...sum,
        [port]: slave,
      };
    }, {});
    const {host, port, origin, server} = await startHttpServer(
      {
        request(req, res) {
          const {url} = getRequestHeaderInfo(req);
          const port = parseInt(url.substring(1));
          const ports = Object.keys(originToSalve);
          if (ports.includes(url)) {
            res.setHeader('content-type', 'application/json');
            res.end(toBuffer(JSON.stringify(originToSalve[port])));
          } else {
            res.setHeader('content-type', 'text/html');
            res.end(
              toBuffer(
                toHtml(
                  toUl(
                    ports.map(it => {
                      return {
                        href: '/' + it,
                        content: it,
                      };
                    })
                  )
                )
              )
            );
          }
        },
      },
      {
        port: config.port,
      }
    );
    const info: DebugServerClusterResponse = {
      pid: process.pid,
      master: {
        origin,
        host,
        port,
      },
      slaves,
    };
    out(info);
  } catch (err) {
    out(err.stack);
  }
}

start();
