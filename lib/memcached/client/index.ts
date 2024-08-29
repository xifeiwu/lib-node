import {TcpNetConnectOpts} from 'net';
import {syntax} from '../service';
import {toBuffer} from '../service/external';
import {
  ClientApi,
  ClientSaveCommandInfo,
  DeleteCommandInfo,
  ErrorMessage,
  Flag,
  GetCommandInfo,
  GetResponseInfo,
  SaveCommandInfo,
  SaveCommandName,
  SaveResponseStatus,
} from '../service/types';
import {getConnection} from './connection';
import {getConnectionKey} from '../service/client';
import {getValueByFlag, getValueFlag} from '../service';

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
      flags: String(Flag.unknown),
      expireTimeInSeconds: 3600 * 24,
      ...(saveOptions ?? {}),
    };
  }

  async save(comandInfo: ClientSaveCommandInfo, command: SaveCommandName) {
    const {value, ...restProps} = comandInfo;
    const flags = getValueFlag(value);
    const buffer = toBuffer(value);
    const bytes = buffer.byteLength;
    const saveCommandInfo: SaveCommandInfo = {
      ...this.defaultSaveOptions,
      command,
      ...restProps,
      flags,
      bytes,
      value: buffer,
    };
    const firstLine = syntax[command].client.commandInfoToBuffer(saveCommandInfo);
    const {socket, dataHandlerQueue} = await getConnection(this.connectOptions);
    socket.write(firstLine);
    const result = await new Promise<SaveResponseStatus | ErrorMessage>((res, rej) => {
      const dataHandler = syntax[command].client.handleResponse((err, response) => {
        if (err) {
          rej(err);
        } else {
          res(response);
        }
      }, saveCommandInfo);
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

  async gets<T = any>(keys: GetCommandInfo['keys']) {
    const commandInfo: GetCommandInfo = {
      command: 'get',
      keys,
    };
    const firstLine = syntax['get'].client.commandInfoToBuffer(commandInfo);
    const {socket, dataHandlerQueue} = await getConnection(this.connectOptions);
    socket.write(firstLine);
    const results = await new Promise<GetResponseInfo[]>((res, rej) => {
      const dataHandler = syntax['get'].client.handleResponse((err, response) => {
        if (err) {
          rej(err);
        } else {
          res(response);
        }
      }, commandInfo);
      dataHandlerQueue.push(dataHandler);
    });
    const obj = results
      .filter(it => it.command === 'VALUE')
      .reduce<{[key: string]: T}>((sum, it) => {
        const {key, flags, value} = it;
        return {
          ...sum,
          [key]: getValueByFlag(value, flags) as T,
        };
      }, {});

    return obj;
  }
  async get<T = any>(key: string) {
    const results = await this.gets([key]);
    return results[key];
  }
  async delete(key: string, noreply?: boolean) {
    const commandInfo: DeleteCommandInfo = {key, command: 'delete', noreply};
    const firstLine = await syntax['delete'].client.commandInfoToBuffer(commandInfo);
    const {socket, dataHandlerQueue} = await getConnection(this.connectOptions);
    socket.write(firstLine);
    const results = await new Promise<Error | true>((res, rej) => {
      const dataHandler = syntax['delete'].client.handleResponse((err, response) => {
        res(err ? err : true);
      }, commandInfo);
      dataHandlerQueue.push(dataHandler);
    });
    return results;
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
