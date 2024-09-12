import {
  getRequestHeaderInfo,
  spawnAndTryIpc,
  startHttpServer,
  toBuffer,
  toHtml,
  toUl,
  InfoToCp,
  toSpawnRelatedInfo,
  SpawnRelatedInfo,
} from '../../index';
import {spawnScript} from './service';
import {out} from './service';
import {DebugServerResponse, DebugServerClusterConfig, DebugServerClusterResponse} from './types';

// export interface DebugServerInfo extends ChildProcessInfo, DebugServerResponse {}

export interface MainDebugServerInfo extends DebugServerResponse {
  pid: number;
  childServerInfo: DebugServerResponse[];
}
export async function start() {
  let ipcMessage: InfoToCp<DebugServerClusterConfig> = {};
  const supportIpc = Boolean(process.send);
  if (supportIpc) {
    ipcMessage = await new Promise<InfoToCp>(res => {
      process.on('message', (chunk: InfoToCp) => {
        // process.send(toBuffer(['ipc channel:', chunk]).toString());
        res(chunk);
      });
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config = {}, spawnConfig} = ipcMessage;
  const {slaveCount = 3, port} = config;
  try {
    const slaves: SpawnRelatedInfo<DebugServerResponse>[] = [];
    /** Start one by one to avoid port confliction */
    let cnt = 0;
    while (cnt++ < slaveCount) {
      const response = await spawnScript<DebugServerResponse>('debug-server.ts', spawnConfig);
      slaves.push(toSpawnRelatedInfo(response));
    }

    const originToSalve = slaves.reduce((sum, slave) => {
      const {responseFromCp} = slave;
      /** For the case ipc channel not open */
      if (!responseFromCp) {
        return sum;
      }
      const {host, port} = responseFromCp;
      return {
        ...sum,
        [port]: slave,
      };
    }, {});
    const {host, port, origin, server} = await startHttpServer(
      {
        request(req, res) {
          const {url} = getRequestHeaderInfo(req);
          const port = url.substring(1);
          const ports = Object.keys(originToSalve);
          if (ports.includes(port)) {
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
