import {Socket, TcpNetConnectOpts} from 'net';
import {TargetServiceInfo} from './v5';
import {SocketInfo} from '../external';

export type TargetSocket = TcpNetConnectOpts | string;

export interface CommonClientExchangeInfoConfig {
  /**
   * can be a origin/href/url
   */
  targetServiceInfo: TargetServiceInfo | string;
}

export interface SocksClientInfo {
  socketInfo: Partial<SocketInfo>;
  stateTracer?: Array<string | object>;
  // targetServiceInfo?: TargetServiceInfo;
  // repliedServiceInfo?: TargetServiceInfo;
  socket?: Socket;
}

/** connect status on server side */
export interface SocksServerInfo extends SocksClientInfo {
  socket2Service?: Socket;
  proxyClientInfo?: SocksClientInfo;
}
