import {TcpNetConnectOpts} from 'net';
import {startSocketClient} from '../../../net';
import {syntax, toBuffer} from '../service';
import {
  ClientApi,
  ClientSaveCommandInfo,
  ErrorMessage,
  RecordItem,
  SaveCommandInfo,
  SaveCommandName,
  SaveStatus,
  StoreApi,
} from '../service/types';
import {getConnection} from '../service/connection-pool';

export class connection implements ClientApi {
  option: TcpNetConnectOpts;
  constructor(option: TcpNetConnectOpts) {
    this.option = option;
  }
  // get() {
  //   return {};
  // }

  async save(comandInfo: ClientSaveCommandInfo, command: SaveCommandName) {
    const {value, ...restProps} = comandInfo;
    const buffer = toBuffer(value);
    const bytes = buffer.byteLength;
    const firstLine = syntax[command].client.toCommandLine({
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
