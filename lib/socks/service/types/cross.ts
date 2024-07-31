import {MethodAuthInfo, ClientRequestInfo as ClientRequestInfo, RespondClientRequest, EMethod} from './v5';
import {Socket, TcpNetConnectOpts} from 'net';
import {SocketInfo} from '../external';
import {BinaryLike} from 'crypto';

export type TargetSocket = TcpNetConnectOpts | string;

interface ClientStatusV5 {
  method: EMethod;
}
interface ClientStatusV6 {
  iv: BinaryLike;
}
export interface SocksStatus extends ClientStatusV5, ClientStatusV6 {
  clientRequestInfo: ClientRequestInfo;
  targetSocksServer: TargetSocket;
  respondClientRequest: RespondClientRequest;
}

export type StatusKey = keyof SocksStatus;
export interface StatusItem {
  key: StatusKey;
  value: SocksStatus[StatusKey];
}
export interface SocksClientStatus {
  socket?: Socket;
  socketInfo: Partial<SocketInfo>;
  stateTracer: Array<string | StatusItem>;
  // targetServiceInfo?: TargetServiceInfo;
  // repliedServiceInfo?: ClientRequestInfo;
}

/** connect status on server side */
export interface SocksServerStatus extends SocksClientStatus {
  socket2Service?: Socket;
  proxyClientStatus?: SocksClientStatus;
}

interface CommonClientNegotiationInfo {
  /**
   * can be a origin/href/url
   */
  clientRequestInfo: ClientRequestInfo | string;
}
interface SocksV5NegotiationInfo {
  methodList?: Array<MethodAuthInfo>;
}
interface SocksV6NegotiationInfo {
  ivBytes?: number;
  auth: {
    username: string;
    password: string;
  };
}

export interface SocksClientV5NegotiationInfo extends CommonClientNegotiationInfo, SocksV5NegotiationInfo {}

export interface SocksClientV6NegotiationInfo extends CommonClientNegotiationInfo, SocksV6NegotiationInfo {}

export interface SocksClientNegotiationInfo {
  v5: SocksClientV5NegotiationInfo;
  v6: SocksClientV6NegotiationInfo;
}

export type SocksVersion = keyof SocksClientNegotiationInfo;

export type SocksClientConfig<Version extends SocksVersion> = SocksClientNegotiationInfo[Version] & {
  /** Identify socks version */
  socksVersion: Version;
  /** target socks server */
  targetSocksServer: TargetSocket;
};

interface CommonServerNegotiationInfo {
  proxyConfigList?: Array<AllSocksProxyConfig>;
}

export interface SocksServerV5NegotiationInfo extends CommonServerNegotiationInfo, SocksV5NegotiationInfo {}

export interface SocksServerV6NegotiationInfo extends CommonServerNegotiationInfo, SocksV6NegotiationInfo {}
interface SocksServerNegotiationInfo {
  v5: SocksServerV5NegotiationInfo;
  v6: SocksServerV6NegotiationInfo;
}

export type SocksServerConfig<Version extends SocksVersion> = SocksServerNegotiationInfo[Version] & {
  // stateTracer: SocksClientStatus['stateTracer'];
  socksVersion: Version;
};

export interface MatchItem {
  address: string;
  port: number;
}
/**
 * can be a socket config or http href
 */
/** proxy to another socks server when address/port meets condition in matches list */
export type SocksProxyConfig<Version extends SocksVersion> = {
  matches: Array<MatchItem | string | RegExp>;
} & Omit<SocksClientConfig<Version>, 'targetServiceInfo'>;

export type AllSocksProxyConfig = SocksProxyConfig<'v5'> | SocksProxyConfig<'v6'>;
