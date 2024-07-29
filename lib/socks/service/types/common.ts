import {ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {TargetServiceInfo, EMethod, MethodAuthInfo} from './v5';

/**
 * @deprecated should diferent per version
 */
export enum ESocksState {
  initial = 'initial',
  startConnectToSocksServer = 'start connect to socks server',
  // connectSocksServerSuccess = 'connect to socks server success',
  // connectSocksServerFail = 'connect to socks server fail',
  startMethodNegotiation = 'start method negotiation',
  methodNegotiationSuccess = 'method negotiation success',
  methodNegotiationFail = 'method negotiation fail',
  startAuthUserPass = 'start auth username/password',
  authUserPassSuccess = 'auth username/password success',
  authUserPassFail = 'auth username/password fail',
  /** client only */
  sendTargetSericeInfo = 'send target service info',
  receiveTargetSericeInfoSuccess = 'send target service info success',
  receiveTargetSericeInfoFail = 'send target service info fail',
  // receive_request_info_success = 'received request info success',
  /** end of client only */
  /** server only */
  waitTargetServiceInfo = 'waiting target service info',
  startConnectToTargerService = 'connect target service',
  connectToTargerServiceSuccess = 'connect target service success',
  connectToTargerServiceFail = 'connect target service fail',
  socket_connect_between_client_target_fail = 'socket connect between client and target fail',
  client_socket_unwritable = 'origin socket unwritable',
  target_socket_unwritable = 'target socket unwritable',
  /** end of server only */
  success = 'success',
  finsih = 'finish',
}

export type SocksVersion = 5 | 6;
/**
 * can be a socket config or http href
 */
export type TargetSocket = TcpNetConnectOpts | string;

export interface CommonSocksClientConfig {
  // socksVersion: SocksVersion;
  /** get tcp connection by net.createConnection */
  // socketConfig?: TcpNetConnectOpts;
  /** get tcp connection by http upgrade */
  targetSocksServer: TargetSocket;
  // methodList: Array<MethodAuthInfo>;
  /**
   * can be a origin/href/url
   */
  targetServiceInfo: TargetServiceInfo | string;
}

export interface SocksStatusOnClientSide {
  // method?: EMethod;
  stateTracer?: string[];
  // iv?: BinaryLike;
  targetServiceInfo?: TargetServiceInfo;
  repliedServiceInfo?: TargetServiceInfo;
  socket?: Socket;
  // error?: Error;
}

/** connect status on server side */
export interface SocksStatusOnServerSide extends SocksStatusOnClientSide {
  socket2Service?: Socket;
  proxyAsClientStatus?: SocksStatusOnClientSide;
}

export interface MatchItem {
  address: string;
  port: number;
}
/** proxy to another socks server when address/port meets condition in matches list */
export interface SocksProxyConfig {
  matches: Array<MatchItem | string | RegExp>;
  targetSocksServer: TargetSocket;
}

export interface CommonServerConfig {
  methodList: Array<MethodAuthInfo>;
  /** proxy to other socks server */
  proxyAsSocketClientConfigList?: SocksProxyConfig[];
  /** on fail duration socks conversation */
  onConnection: (status: SocksStatusOnServerSide) => void;
}

// export interface SocketServerConfig extends CommonServerConfig {
//   serverConfig?: {
//     host?: string;
//     port?: number;
//     options?: ServerOpts;
//   };
//   /** start a http server to expose status of socks server by this config */
//   httpServerConfig?: {
//     host?: string;
//     port: number;
//   };
// }

// export interface HttpServerConfig extends CommonServerConfig, CustomProtocol {
//   serverConfig?: {
//     host?: string;
//     port: number;
//   };
// }
