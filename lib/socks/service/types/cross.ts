import {
  MethodAuthInfo,
  RequestTargetV5 as RequestTargetV5,
  RespondOfRequestTargetV5,
  EMethod,
  NegotiationInfo as NegotiationInfoV5,
  ServerConfig as ServerConfigV5,
} from './v5';
import {Socket, TcpNetConnectOpts} from 'net';
import {SocketInfo} from '../external';
import {BinaryLike} from 'crypto';
import {NegotiationInfo as NegotiationInfoVc1, ServerConfig as ServerConfigVc1} from './vc1';

export interface NegotiationInfo {
  v5: NegotiationInfoV5;
  vc1: NegotiationInfoVc1;
}

export type SocksVersion = keyof NegotiationInfo;

export type SocksClientConfig<Version extends SocksVersion> = NegotiationInfo[Version] & {
  /** Identify socks version */
  socksVersion: Version;
  /** target socks server */
  targetSocksServer: TargetSocket;
};

interface ServerConfig {
  v5: ServerConfigV5;
  vc1: ServerConfigVc1;
}

export type SocksServerConfig<Version extends SocksVersion> = ServerConfig[Version] & {
  socksVersion: Version;
  proxyConfigList?: Array<AllSocksProxyConfig>;
};

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
  requestTarget?: RequestTargetV5;
  respondOfRequestTarget: RespondOfRequestTargetV5;
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
  clientRequestInfo?: RequestTargetV5;
  respondClientRequest?: RespondOfRequestTargetV5;
}

/** connect status on server side */
export interface SocksServerStatus extends SocksClientStatus {
  socket2Service?: Socket;
  proxyClientStatus?: SocksClientStatus;
}

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

export type AllSocksProxyConfig = SocksProxyConfig<'v5'> | SocksProxyConfig<'vc1'>;


export type NegotiationWithServer<Version extends SocksVersion> = (
  socket: Socket,
  config: NegotiationInfo[Version],
  clientInfo?: SocksClientStatus
) => Promise<{
  respondOfRequestTarget: RespondOfRequestTargetV5;
}>;

export type NegotiationWithClient<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientStatus
) => Promise<{
  requestTarget: RequestTargetV5;
}>;

export type ConnectToTargetServerFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientStatus
) => Promise<{
  socket: Socket;
  proxyClientStatus?: SocksClientStatus;
}>;
