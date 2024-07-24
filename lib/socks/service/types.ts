import {ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {TargetServiceInfo, EMethod, MethodAuthInfo} from './protocol/types';
import {CustomProtocol} from '../protocol-custom/types';
import {BinaryLike} from 'crypto';
export * from './protocol/types';

export enum ESocksState {
  initial = 'initial',
  connecting = 'connecting',
  connected = 'connected',
  connect_fail = 'connecting fail',
  method_negotiation = 'method negotiation',
  method_negotiation_success = 'method negotiation',
  method_negotiation_fail = 'method negotiation fail',
  auth_username_password_start = 'auth by username/password',
  auth_username_password_success = 'auth by username/password',
  auth_username_password_fail = 'failed auth by username/password',
  /** client only */
  send_request_info = 'send request info',
  send_request_info_success = 'send request info success',
  send_request_info_fail = 'send request info fail',
  receive_request_info_success = 'received request info success',
  /** end of client only */
  /** server only */
  wait_targer_service_info = 'waiting target service info',
  connect_to_targer_service = 'connect target service',
  connect_to_targer_service_success = 'connect target service success',
  connect_to_targer_service_fail = 'connect target service fail',
  socket_connect_between_client_target_fail = 'socket connect between client and target fail',
  client_socket_unwritable = 'origin socket unwritable',
  target_socket_unwritable = 'target socket unwritable',
  /** end of server only */
  success = 'success',
  finsih = 'finish',
}

export interface ClientConfig extends CustomProtocol {
  /** get tcp connection by net.createConnection */
  socketConfig?: TcpNetConnectOpts;
  /** get tcp connection by http upgrade */
  httpUrl?: string;
  methodList: Array<MethodAuthInfo>;
  targetServiceInfo: TargetServiceInfo;
}

export interface SocksStatusOnClientSide {
  state?: ESocksState;
  iv?: BinaryLike;
  method?: EMethod;
  targetServiceInfo?: TargetServiceInfo;
  replyServiceInfo?: TargetServiceInfo;
  socket?: Socket;
  error?: Error;
}

/** connect status on server side */
export interface SocksStatusOnServerSide extends SocksStatusOnClientSide {
  socket2Service?: Socket;
  proxyAsClientStatus?: SocksStatusOnClientSide;
}

export interface MatchItem {
  address: string | RegExp;
  port: number;
}
/** proxy to another socks server when address/port meets condition in matches list */
export interface ProxyAsSocksClientConfig extends Omit<ClientConfig, 'targetServiceInfo'> {
  matches: Array<MatchItem | string | RegExp>;
}

export interface CommonServerConfig {
  methodList: Array<MethodAuthInfo>;
  /** proxy to other socks server */
  proxyAsSocketClientConfigList?: ProxyAsSocksClientConfig[];
  /** on fail duration socks conversation */
  onConnection: (status: SocksStatusOnServerSide) => void;
}

export interface SocketServerConfig extends CommonServerConfig, CustomProtocol {
  serverConfig?: {
    host?: string;
    port?: number;
    options?: ServerOpts;
  };
  /** start a http server to expose status of socks server by this config */
  httpServerConfig?: {
    host?: string;
    port: number;
  };
}

export interface HttpServerConfig extends CommonServerConfig, CustomProtocol {
  serverConfig?: {
    host?: string;
    port: number;
  };
}
