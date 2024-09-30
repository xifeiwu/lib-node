import {Socket} from 'net';
import {RequestTargetV5Response, ServerConfig as ServerConfigV5} from './v5';
import {ServerConfig as ServerConfigVc1} from './vc1';
import {NegotiationResult, SocksClientConfig, SocksInfoOnClient, SocksVersion} from './client';
import {StateTracer} from './base';

export interface ServerConfig {
  v5: ServerConfigV5;
  vc1: ServerConfigVc1;
}

export type SocksServerConfig<Version extends SocksVersion> = ServerConfig[Version] & {
  socksVersion: Version;
  proxyConfigList?: Array<ProxyConfig>;
};

/** connect status on server side */
export interface SocksInfoOnServer extends SocksInfoOnClient {
  socket2Remote?: Socket;
  socksClientInfo?: SocksInfoOnClient;
}

export interface MatchItem {
  address: string;
  port: number;
}

/**
 * Proxy to another socks server when address/port meets condition in matches list
 * Compared to SocksClientConfig, add property matches, remove requestTarget
 */
export type SocksProxyConfig<Version extends SocksVersion> = {
  matches: Array<MatchItem | string | RegExp>;
} & Omit<SocksClientConfig<Version>, 'requestTarget'>;

export type ProxyConfig = SocksProxyConfig<'v5'> | SocksProxyConfig<'vc1'>;

/**
 * Negotiation with client and get related info from client.
 */
export type NegotiationWithClient<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  stateTracer?: StateTracer
) => Promise<NegotiationResult[Version]>;
export type SendRequestTargetResponse<Version extends SocksVersion> = (
  socket: Socket,
  response: RequestTargetV5Response,
  negotiationResult: NegotiationResult[Version]
) => Promise<boolean>;
