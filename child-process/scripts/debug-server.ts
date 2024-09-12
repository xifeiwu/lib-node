import {startHttpDebugServer} from '../../index';
import {out} from './service';
import {DebugServerConfig, DebugServerResponse, MessageToCp} from './types';

export async function start() {
  let ipcMessage: MessageToCp<DebugServerConfig> = {};
  if (process.send) {
    ipcMessage = await new Promise<MessageToCp<DebugServerConfig>>(res => {
      process.on('message', (chunk: MessageToCp<DebugServerConfig>) => {
        // process.send(toBuffer(['ipc channel:', chunk]).toString());
        res(chunk);
      });
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config: {port: port2} = {} as DebugServerConfig} = ipcMessage;
  try {
    const {origin, host, port} = await startHttpDebugServer({port: port2});
    const info: DebugServerResponse = {origin, host, port};
    out(info);
  } catch (err) {
    out(err.message);
  }
}

start();
