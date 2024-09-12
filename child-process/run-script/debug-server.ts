import {startHttpServer, responseRequestEvent, InfoToCp} from '../../index';
import {out, runCpCustomization} from './service';
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
  const {config: {port: port2, customization} = {} as DebugServerConfig} = ipcMessage;
  await runCpCustomization(customization);
  try {
    const {origin, host, port} = await startHttpServer(
      {
        request(request, response) {
          console.log(request.url);
          responseRequestEvent(request, response);
        },
      },
      {port: port2}
    );
    const info: DebugServerResponse = {origin, host, port};
    out(info);
  } catch (err) {
    out(err.message);
  }
}

start();
