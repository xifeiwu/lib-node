import {MethodAuthInfo, RequestTarget as RequestTarget, RespondOfRequestTarget, EMethod} from './v5';
import {Socket, TcpNetConnectOpts} from 'net';
import {SocketInfo} from '../external';
import {BinaryLike} from 'crypto';

export type TargetSocket = TcpNetConnectOpts | string;

/**
 * Different between Tracer and Status
 * 1. Tracer used on record logic process, Status used to store important info of Socks end.
 */
interface TracerInfoV5 {
  method: EMethod;
}
interface TracerInfoV6 {
  iv: BinaryLike;
}
export interface TracerInfo extends TracerInfoV5, TracerInfoV6 {
  targetSocksServer: TargetSocket;
  requestTarget?: RequestTarget;
  respondOfRequestTarget: RespondOfRequestTarget;
}

export type TracerKey = keyof TracerInfo;
export interface TracerItem {
  key: TracerKey;
  value: TracerInfo[TracerKey];
}

export interface SocksClientStatus {
  socket?: Socket;
  socketInfo?: Partial<SocketInfo>;
  stateTracer: Array<string | TracerItem>;
  clientRequestInfo?: RequestTarget;
  respondClientRequest?: RespondOfRequestTarget;
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
  requestTarget: RequestTarget | string;
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

export interface SocksClientNegotiationInfoV5 extends CommonClientNegotiationInfo, SocksV5NegotiationInfo {}

export interface SocksClientNegotiationInfoV6 extends CommonClientNegotiationInfo, SocksV6NegotiationInfo {}

export interface SocksClientNegotiationInfo {
  v5: SocksClientNegotiationInfoV5;
  v6: SocksClientNegotiationInfoV6;
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

export interface SocksServerNegotiationInfoV5 extends CommonServerNegotiationInfo, SocksV5NegotiationInfo {}

export interface SocksServerNegotiationInfoV6 extends CommonServerNegotiationInfo, SocksV6NegotiationInfo {}
interface SocksServerNegotiationInfo {
  v5: SocksServerNegotiationInfoV5;
  v6: SocksServerNegotiationInfoV6;
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
} & Omit<SocksClientConfig<Version>, 'requestTarget'>;

export type AllSocksProxyConfig = SocksProxyConfig<'v5'> | SocksProxyConfig<'v6'>;

export type InfoNegotiationFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksClientNegotiationInfo[Version],
  clientInfo?: SocksClientStatus
) => Promise<{
  respondOfRequestTarget: RespondOfRequestTarget;
}>;

export type GetClientRequestTargetFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerNegotiationInfo[Version],
  clientInfo: SocksClientStatus
) => Promise<{
  requestTarget: RequestTarget;
}>;

export type ConnectToTargetServerFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerNegotiationInfo[Version],
  clientInfo: SocksClientStatus
) => Promise<{
  socket: Socket;
  proxyClientStatus?: SocksClientStatus;
}>;
