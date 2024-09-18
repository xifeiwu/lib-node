import {startHttpServer, responseRequestEvent, InfoToCp, getAFreePort} from '../../index';
import {handleCpCustomization, out, runAllCpCustomization} from './service';
import {DebugServerConfig, DebugServerResponse} from './types';

export async function start() {
  let ipcMessage: InfoToCp<DebugServerConfig> = {};
  if (process.send) {
    ipcMessage = await new Promise<InfoToCp<DebugServerConfig>>(res => {
      process.once('message', (chunk: InfoToCp<DebugServerConfig>) => {
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
              console.log(request.url);
              responseRequestEvent(request, response);
            },
          },
          {port: config[key]}
        );
        const info: DebugServerResponse = {origin, host, port};
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
