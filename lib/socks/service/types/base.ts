import {Socket} from 'net';
import {TargetServiceInfo} from './v5';
import {SocketInfo} from '../external';

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

export interface CommonSocksClientConfig {
  /**
   * can be a origin/href/url
   */
  targetServiceInfo: TargetServiceInfo | string;
}

export interface SocksClientInfo {
  socketInfo: Partial<SocketInfo>;
  stateTracer?: Array<string | object>;
  targetServiceInfo?: TargetServiceInfo;
  repliedServiceInfo?: TargetServiceInfo;
  socket?: Socket;
}

/** connect status on server side */
export interface SocksServerInfo extends SocksClientInfo {
  socket2Service?: Socket;
  proxyClientInfo?: SocksClientInfo;
}
