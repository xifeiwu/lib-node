import {TcpNetConnectOpts} from 'net';
import {syntax, toBuffer} from '../service';
import {
  ClientApi,
  ClientSaveCommandInfo,
  ErrorMessage,
  GetCommandInfo,
  GetResponseInfo,
  SaveCommandName,
  SaveStatus,
} from '../service/types';
import {getConnection} from './connection';
import {getConnectionKey} from '../service/client';

export class Client implements ClientApi {
  option: TcpNetConnectOpts;
  constructor(option: TcpNetConnectOpts) {
    this.option = option;
  }
  async get(keys: GetCommandInfo['keys']) {
    const firstLine = syntax['get'].client.commandInfoToBuffer({
      command: 'get',
      keys,
    });
    const {socket, dataHandlerQueue} = await getConnection(this.option);
    socket.write(firstLine);
    const result = await new Promise<GetResponseInfo[]>((res, rej) => {
      const dataHandler = syntax['get'].client.handleResponse((err, response) => {
        if (err) {
          rej(err);
        } else {
          res(response);
        }
      });
      dataHandlerQueue.push(dataHandler);
    });
    return result;
  }

  async save(comandInfo: ClientSaveCommandInfo, command: SaveCommandName) {
    const {value, ...restProps} = comandInfo;
    const buffer = toBuffer(value);
    const bytes = buffer.byteLength;
    const firstLine = syntax[command].client.commandInfoToBuffer({
      command,
      ...restProps,
      bytes,
      value: buffer,
    });
    const {socket, dataHandlerQueue} = await getConnection(this.option);
    socket.write(firstLine);
    const result = await new Promise<SaveStatus | ErrorMessage>((res, rej) => {
      const dataHandler = syntax[command].client.handleResponse((err, response) => {
        if (err) {
          rej(err);
        } else {
          res(response);
        }
      });
      dataHandlerQueue.push(dataHandler);
    });
    return result;
  }
  async set(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'set');
  }
  async add(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'add');
  }
  async replace(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'replace');
  }
  async append(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'append');
  }
  async prepend(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'prepend');
  }
  async cas(comandInfo: ClientSaveCommandInfo) {
    return await this.save(comandInfo, 'cas');
  }
}

const clientMap: {
  [key: string]: Client;
} = {};
export function getClient(options: TcpNetConnectOpts) {
  const key = getConnectionKey(options);
  if (!clientMap[key]) {
    clientMap[key] = new Client(options);
  }
  const client = clientMap[key];
  return client;
}
