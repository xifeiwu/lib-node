import {TcpNetConnectOpts} from 'net';
import {syntax, toBuffer} from '../service';
import {
  ClientApi,
  ClientFlag,
  ClientSaveCommandInfo,
  ErrorMessage,
  GetCommandInfo,
  GetResponseInfo,
  SaveCommandName,
  SaveResponseStatus,
} from '../service/types';
import {getConnection} from './connection';
import {getConnectionKey} from '../service/client';

interface DefaultSaveOptions {
  flags: ClientSaveCommandInfo['flags'];
  expireTimeInSeconds: ClientSaveCommandInfo['expireTimeInSeconds'];
}
export class Client implements ClientApi {
  connectOptions: TcpNetConnectOpts;
  defaultSaveOptions: DefaultSaveOptions;
  constructor(option: TcpNetConnectOpts, saveOptions?: DefaultSaveOptions) {
    this.connectOptions = option;
    this.defaultSaveOptions = {
      flags: String(ClientFlag.json),
      expireTimeInSeconds: 3600 * 24,
      ...(saveOptions ?? {}),
    };
  }
  async get(keys: GetCommandInfo['keys']) {
    const firstLine = syntax['get'].client.commandInfoToBuffer({
      command: 'get',
      keys,
    });
    const {socket, dataHandlerQueue} = await getConnection(this.connectOptions);
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
      ...this.defaultSaveOptions,
      command,
      ...restProps,
      bytes,
      value: buffer,
    });
    const {socket, dataHandlerQueue} = await getConnection(this.connectOptions);
    socket.write(firstLine);
    const result = await new Promise<SaveResponseStatus | ErrorMessage>((res, rej) => {
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
export function getClient(netOptions: TcpNetConnectOpts, saveOptions?: DefaultSaveOptions) {
  const key = getConnectionKey(netOptions);
  if (!clientMap[key]) {
    clientMap[key] = new Client(netOptions, saveOptions);
  }
  const client = clientMap[key];
  return client;
}
