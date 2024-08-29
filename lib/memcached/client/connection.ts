import {TcpNetConnectOpts} from 'net';
import {startSocketClient} from '../../../net';
import {getConnectionKey} from '../service/client';
import {ConnectionInfo, DataHandler} from '../service';

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
    while (Buffer.isBuffer(info.cachedBuffer) && info.cachedBuffer.byteLength > 0) {
      const {remainingBuffer, done} = (await info.dataHandlerQueue[0](info.cachedBuffer, socket)) ?? {};
      info.cachedBuffer = remainingBuffer;
      if (done) {
        info.dataHandlerQueue.shift();
        break;
      }
    }
  });
  return info;
}

const connectionInfoMap: {
  [key: string]: ConnectionInfo;
} = {};
export async function getConnection(options: TcpNetConnectOpts, dataHandler?: DataHandler) {
  const key = getConnectionKey(options);
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
