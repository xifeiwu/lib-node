import {TcpNetConnectOpts} from 'net';
import {startSocketClient} from '../../../net';
import {syntax} from '../service';
import {
  ClientApi,
  ClientSaveCommandInfo,
  RecordItem,
  SaveCommandInfo,
  SaveStatus,
  StoreApi,
} from '../service/types';

export class connection implements ClientApi {
  option: TcpNetConnectOpts;
  constructor(option: TcpNetConnectOpts) {
    this.option = option;
  }
  get() {
    return {};
  }
  set(comandInfo: ClientSaveCommandInfo) {
    syntax['set'].client.toCommandLine(comandInfo);
    return SaveStatus.STORED;
  }
  add(commandINfo: ClientSaveCommandInfo) {
    return SaveStatus.STORED;
  }
  replace(commandINfo: ClientSaveCommandInfo) {
    return SaveStatus.STORED;
  }
  append(commandINfo: ClientSaveCommandInfo) {
    return SaveStatus.STORED;
  }
  prepend(commandINfo: ClientSaveCommandInfo) {
    return SaveStatus.STORED;
  }
  cas(commandINfo: ClientSaveCommandInfo) {
    return SaveStatus.STORED;
  }
}

