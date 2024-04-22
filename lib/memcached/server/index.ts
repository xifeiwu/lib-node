import net, {ServerOpts, Socket} from 'net';
import {getAFreePort} from '../service/external';
import {CommandName, GeneralCommandInfo, GetCommandInfo, SaveCommandInfo} from '../service/types';
import {parseFirstLine, syntax} from '../service';
import {store} from './store';
import {AfterReceiveDataStatus, tryConsumeData} from '../service/convert';

async function handleConnection(socket: Socket) {
  let commandInfo: GeneralCommandInfo | null = null;
  /** whether current command need to consume more data */
  let onReceiveDataToCommand: (chunk: Buffer) => AfterReceiveDataStatus = null;

  let cachedBuffer: Buffer | undefined = Buffer.alloc(0);
  function onData(chunk: Buffer) {
    socket.pause();
    if (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
      cachedBuffer = Buffer.concat([cachedBuffer, chunk]);
    } else {
      cachedBuffer = chunk;
    }
    while (Buffer.isBuffer(cachedBuffer) && cachedBuffer.byteLength > 0) {
      if (!onReceiveDataToCommand) {
        /** start to parse command(first) line */
        const {commandItems, remainingBuffer: restBuffer} = parseFirstLine(cachedBuffer);
        const [commandName] = commandItems;
        commandInfo = syntax[commandName].server.toCommandInfo(commandItems);
        const {remainingBuffer, onReceiveData} = tryConsumeData(commandInfo, restBuffer);
        cachedBuffer = remainingBuffer;
        onReceiveDataToCommand = onReceiveData;
        if (!Boolean(onReceiveData)) {
          const res = syntax[commandName].server.handleCommand(commandInfo as any, store);
          /** res === undefined means no need to send response to client side */
          if (res !== undefined) {
            socket.write(res);
          }
        }
      } else {
        const {command} = commandInfo;
        const {remainingBuffer, needContinueConsume} = onReceiveDataToCommand(cachedBuffer);
        cachedBuffer = remainingBuffer;
        if (!needContinueConsume) {
          const res = syntax[command].server.handleCommand(commandInfo as any, store);
          /** res === undefined means no need to send response to client side */
          if (res !== undefined) {
            socket.write(res);
          }
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
