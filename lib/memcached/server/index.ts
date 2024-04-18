import net, {ServerOpts, Socket} from 'net';
import {getAFreePort} from '../service/external';
import {CommandName, GetCommandInfo, SaveCommandInfo} from '../service/types';
import {syntax} from '../service';
import {store} from './store';
import {AfterReceiveStatus, tryParseCommand} from '../service/convert';
import {getCommand} from '../service/common';

async function handleConnection(socket: Socket) {
  let commandInfo: SaveCommandInfo | GetCommandInfo | null = null;
  /** whether current command need to consume more data */
  let onReceiveDataToCommand: (chunk: Buffer) => AfterReceiveStatus = null;

  let cachedBuffer: Buffer | undefined = Buffer.alloc(0);
  function onData(chunk: Buffer) {
    socket.pause();
    if (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
      cachedBuffer = Buffer.concat([cachedBuffer, chunk]);
    } else {
      cachedBuffer = chunk;
    }
    while (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
      if (onReceiveDataToCommand === null) {
        /** start to parse command(first) line */
        const command = getCommand(cachedBuffer);
        const {
          item,
          remainingBuffer,
          onReceiveData,
        } = tryParseCommand<SaveCommandInfo | GetCommandInfo>(
          cachedBuffer,
          syntax[command].server.parseCommand
        );
        cachedBuffer = remainingBuffer;
        onReceiveDataToCommand = onReceiveData;
        commandInfo = item;
        if (!Boolean(onReceiveData)) {
          const res = syntax[command].server.handleCommand(commandInfo as any, store);
          socket.write(res);
        }
      } else {
        const {command} = commandInfo;
        const {remainingBuffer, needConsume} = onReceiveDataToCommand(cachedBuffer);
        cachedBuffer = remainingBuffer;
        if (!needConsume) {
          const res = syntax[command].server.handleCommand(commandInfo as any, store);
          socket.write(res);
          onReceiveDataToCommand = null;
        }
      }
    }
    socket.resume();
  }
  socket.on('data', onData);
}
export async function startServer(config?: {port?: number; host?: string; options?: ServerOpts}) {
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config ?? {};
  return new Promise<{host: string; port: number}>((res, rej) => {
    const server = net.createServer(options, handleConnection);
    server.on('listening', () => {
      res({host, port});
    });
    server.on('error', err => {
      rej(err);
    });
    server.listen(port, host);
  });
}
