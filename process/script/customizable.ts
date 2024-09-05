import {isNumber, waitFor} from '@modules/lib/fe';
import {startHttpDebugServer} from '@modules/lib/node';
import {out} from './service';

interface CustomizeProps {
  /** delay in ms */
  delay?: number;
  port?: number;
}
export async function start() {
  if (!process.send) {
    throw new Error(`Should open ipc channel`);
  }
  const timeoutTag = setTimeout(() => {
    throw new Error(`Not receive customize config`);
  }, 3000);
  const config = await new Promise<CustomizeProps>(res => {
    process.on('message', (chunk: CustomizeProps) => {
      // process.send(toBuffer(['ipc channel:', chunk]).toString());
      res(chunk);
    });
  });
  clearTimeout(timeoutTag);
  const {delay, port} = config ?? {};
  if (isNumber(delay) && delay > 0) {
    await waitFor(delay);
  }
  const {origin} = await startHttpDebugServer({port});
  // console.log(``)
  out(origin);
}

start();
