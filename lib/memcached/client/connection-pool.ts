// export async function connect(options: TcpNetConnectOpts) {
//   const socket = await startSocketClient(options);
//   const
//   socket.on('data', (chunk: Buffer) => {});
// }
import {Socket} from 'dgram';
import net, {TcpNetConnectOpts} from 'net';
import {startSocketClient} from '../../../net';

type DataHandler = (
  chunk: Buffer,
  socket: net.Socket
  // cb: (err, data: any) => void
) => Promise<{
  remainingBuffer?: Buffer;
  done?: boolean;
}>;
interface ConnectionInfo {
  socket: net.Socket;
  cachedBuffer?: Buffer;
  dataHandlerQueue?: Array<DataHandler>;
}

async function getOneConnection(options: TcpNetConnectOpts): Promise<ConnectionInfo> {
  const socket = await startSocketClient(options);
  const info: ConnectionInfo = {
    socket,
    dataHandlerQueue: [],
  };
  // const {socket, dataHandlerQueue} = info;
  socket.on('data', async (chunk: Buffer) => {
    if (!Buffer.isBuffer(info.cachedBuffer)) {
      info.cachedBuffer = chunk;
    } else {
      info.cachedBuffer = Buffer.concat([info.cachedBuffer, chunk]);
    }
    if (info.dataHandlerQueue.length === 0) {
      throw new Error(`no handler but get data`);
    }
    while (info.cachedBuffer.byteLength > 0) {
      const {remainingBuffer, done} = (await info.dataHandlerQueue[0](info.cachedBuffer, socket)) ?? {};
      if (done) {
        info.dataHandlerQueue.shift();
        break;
      }
      info.cachedBuffer = remainingBuffer;
    }
  });
  return info;
}

const connectionInfoMap: {
  [key: string]: ConnectionInfo;
} = {};
export async function getConnection(options: TcpNetConnectOpts, dataHandler?: DataHandler) {
  const {host = '', port} = options;
  const key = host + port;
  if (!connectionInfoMap[key]) {
    connectionInfoMap[key] = await getOneConnection(options);
  }
  const info = connectionInfoMap[key];
  const {dataHandlerQueue} = info;
  if (dataHandler) {
    dataHandlerQueue.push(dataHandler);
  }
  return info;
}
