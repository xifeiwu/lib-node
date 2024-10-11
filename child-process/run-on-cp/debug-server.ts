import {startHttpServer, responseRequestEvent, InfoToCp, getAFreePort, toBuffer} from '../../index';
import {handleCpCustomization, out, runAllCpCustomization} from './service';
import {CP} from '../../types';

export async function start() {
  let ipcMessage: InfoToCp<CP.DebugServerConfig> = {};
  if (process.send) {
    ipcMessage = await new Promise<InfoToCp<CP.DebugServerConfig>>(res => {
      process.once('message', (chunk: InfoToCp<CP.DebugServerConfig>) => {
        res(chunk);
      });
      /** Wait message for one second at most */
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config = {}} = ipcMessage;
  /** Make sure port property exist */
  if (config['port'] === undefined) {
    config['port'] = await getAFreePort();
  }
  for (const key of Object.keys(config)) {
    if (key === 'port') {
      try {
        const {origin, host, port} = await startHttpServer(
          {
            request(request, response) {
              const {url} = request;
              console.log(url);
              if (url === '/api/exit') {
                response.statusCode = 302;
                const url = '/api/list';
                response.setHeader('Location', url);
                response.setHeader('content-type', 'text/plain; charset=utf-8');
                response.end(toBuffer(`Redirecting to <a href="${url}">${url}</a>.`));
                setTimeout(() => {
                  process.exit(0);
                }, 2000);
              } else {
                responseRequestEvent(request, response);
              }
            },
          },
          {port: config[key]}
        );
        const info: CP.DebugServerResponse = {origin, host, port};
        out(info);
      } catch (err) {
        out(err.message);
      }
    } else {
      await handleCpCustomization(config, key);
    }
  }
}

start();
