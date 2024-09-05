import {startHttpDebugServer} from '../../index';
import {out} from './service';
import {ServerInfo} from './types';

interface CustomizeProps {
  port?: number;
}
export async function start() {
  let config: CustomizeProps = {};
  if (process.send) {
    config = await new Promise<CustomizeProps>(res => {
      process.on('message', (chunk: CustomizeProps) => {
        // process.send(toBuffer(['ipc channel:', chunk]).toString());
        res(chunk);
      });
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {port: port2} = config ?? {};
  try {
    const {origin, host, port} = await startHttpDebugServer({port: port2});
    const info: ServerInfo = {origin, host, port};
    out(info);
  } catch (err) {
    out(err.message);
  }
}

start();
