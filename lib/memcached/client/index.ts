import {TcpNetConnectOpts} from 'net';
import {startSocketClient} from '../../../net';
import {syntax} from '../service';
import {
  ClientApi,
  ClientCommandInfo,
  RecordItem,
  SaveCommandInfo,
  SaveStatus,
  StoreApi,
} from '../service/types';

export class Storage implements ClientApi {
  get() {
    return {};
  }
  set(comandInfo: ClientCommandInfo) {
    syntax['set'].client.toCommandLine(comandInfo);
    return SaveStatus.STORED;
  }
  add(commandINfo: ClientCommandInfo) {
    return SaveStatus.STORED;
  }
  replace(commandINfo: ClientCommandInfo) {
    return SaveStatus.STORED;
  }
  append(commandINfo: ClientCommandInfo) {
    return SaveStatus.STORED;
  }
  prepend(commandINfo: ClientCommandInfo) {
    return SaveStatus.STORED;
  }
  cas(commandINfo: ClientCommandInfo) {
    return SaveStatus.STORED;
  }
}
