import fs from 'fs';
import {startSocketClient} from '../../net';
import {fromBuffer, toBuffer} from '../../transform';
import {CP} from '../../types';

export async function ping(
  socketPath: string,
  config?: {
    closeOnInActive?: boolean;
  }
) {
  const {closeOnInActive = true} = config ?? {};
  try {
    const action: CP.DaemonAction = {action: 'ping'};
    const client = await startSocketClient(socketPath);
    client.end(toBuffer(action));
    return await new Promise<CP.DaemonInfo>((res, rej) => {
      client.once('data', chunk => {
        res(fromBuffer(chunk, 'json') as CP.DaemonInfo);
      });
    });
  } catch (err) {
    if (closeOnInActive) {
      fs.unlinkSync(socketPath);
    }
  }
}
