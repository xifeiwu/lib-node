import {Socket} from 'net';
import {RequestTargetResponseV5, ServerConfig as ServerConfigV5} from './v5';
import {ServerConfig as ServerConfigVc1} from './vc1';
import {NegotiationResult, SocksClientConfig, SocksClientInfo} from './client';
import {SocksVersion} from './common';
import {StateTracer} from './base';

/**
 * Config pre version
 */
export interface ServerConfig {
  5: ServerConfigV5;
  1: ServerConfigVc1;
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

export type ProxyConfig = SocksProxyConfig<5> | SocksProxyConfig<1>;

export type SocksServerConfig<Version extends SocksVersion = any> = ServerConfig[Version] & {
  socksVersion: Version;
  proxyConfigList?: Array<ProxyConfig>;
};

export type SocksServerConfigPerVersion = {
  1: SocksServerConfig[1];
  5: SocksServerConfig[5];
  // [v in SocksVersion]: SocksServerConfig<SocksVersion>;
};

/** connect status on server side */
export interface SocksServerInfo extends SocksClientInfo {
  socket2Remote?: Socket;
  socksClientInfo?: SocksClientInfo;
}

/**
 * Negotiation with client and get related info from client.
 */
export type NegotiationWithClient<Version extends SocksVersion> = (
  socket: Socket,
  config: ServerConfig[Version],
  stateTracer?: StateTracer
) => Promise<NegotiationResult[Version]>;
/**
 * After complete RequestTarget from client side, send RequestTargetResponse,
 * then all negotiation process is finished.
 */
export type SendRequestTargetResponse<Version extends SocksVersion> = (
  socket: Socket,
  response: RequestTargetResponseV5,
  negotiationResult: NegotiationResult[Version]
) => Promise<boolean>;
