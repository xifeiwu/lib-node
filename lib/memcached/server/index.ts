import net, {ServerOpts, Socket} from 'net';
import {getAFreePort} from '../service/external';
import {CommandName, ErrorStatus, GetCommandInfo, GetCommandName, SaveCommandInfo, SaveCommandName} from '../service/types';
import {getError, parseCommandLine} from './service';
import {syntax} from '../service';
import {store} from './store';
import {isNumber} from '../../../external';
import {firstLineReg, tryParseCommandLine} from '../service/convert';

async function handleConnection(socket: Socket) {
  let command: CommandName | null = null;

  function getCommand(chunk: Buffer): CommandName {
    const index = chunk.findIndex((it, index) => {
      return it === 0x0d && chunk[index + 1] === 0x0a;
    });
    const firstLine = chunk.subarray(0, index).toString('utf-8');
    const execRes = firstLineReg.exec(firstLine);
    if (!execRes) {
      throw new Error(`Error getCommand, format of first line command is not corrrect: ${firstLine}`);
    }
    return execRes[1] as CommandName;
    // const data = chunk.subarray(index + 2);
    // const info = parseCommandLine(firstLine);
    // return {info, data};
  }
  // function socketWrite(data: string | Buffer) {
  //   socket.write(appendCRLF(data));
  // }
  function onData(chunk: Buffer) {
    socket.pause();
    if (command === null) {
      command = getCommand(chunk);
    }
    const {item, remaining, onReceiveData} = tryParseCommandLine(chunk, syntax[command].server.parseCommand);
    if (onReceiveData === undefined) {
      syntax[command].server.handleCommand(item.key, store)
    }


    try {
      let receivedAllData = false;
      if (!commandInfo) {
        const {info, data} = parseFirstChunkOfCommand(chunk);
        commandInfo = info;
        const {command} = info;
        if (store?.[commandInfo.command] === undefined) {
          throw new Error(getError(ErrorStatus.SERVER_ERROR, `command ${commandInfo.command} not support`));
        }
        if (!Object.prototype.hasOwnProperty.call(syntax, command)) {
          throw new Error(getError(ErrorStatus.CLIENT_ERROR, `command ${command} not support`));
        }
        receivedAllData = syntax[commandInfo.command]?.serverOnData(data, commandInfo);
      } else {
        receivedAllData = syntax[commandInfo.command]?.serverOnData(chunk, commandInfo);
      }
      if (receivedAllData) {
        // let response: string | null = null;
        // const {command, key, bytes} = commandInfo;
        // // if (isNumber(bytes) && commandInfo.bytes > 0) {
        // response = store?.[command](key, commandInfoToRecord(commandInfo));
        // }
        const response = syntax[commandInfo.command].serverResponse(store, commandInfo);
        if (response !== null) {
          socketWrite(response);
        }
        commandInfo = null;
      }
    } catch (err) {
      return socketWrite(err.message);
    }
    socket.resume();
  }
  socket.on('data', onData);
}
export async function startServer(config: {port: number; host?: string; options?: ServerOpts}) {
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config;
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
