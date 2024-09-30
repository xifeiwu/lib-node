import {Socket} from 'net';
import {ServerConfig as ServerConfigV5} from './v5';
import {ServerConfig as ServerConfigVc1} from './vc1';
import {NegotiationResult, SocksClientConfig, SocksClientInfo, SocksVersion} from './client';

interface ServerConfig {
  v5: ServerConfigV5;
  vc1: ServerConfigVc1;
}

export type SocksServerConfig<Version extends SocksVersion> = ServerConfig[Version] & {
  socksVersion: Version;
  proxyConfigList?: Array<ProxyConfig>;
};

/** connect status on server side */
export interface SocksServerStatus extends SocksClientInfo {
  socket2Service?: Socket;
  proxyClientStatus?: SocksClientInfo;
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

export type NegotiationWithClient<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientInfo
) => Promise<NegotiationResult[Version]>;

export type ConnectToTargetServerFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientInfo
) => Promise<{
  socket: Socket;
  proxyClientStatus?: SocksClientInfo;
}>;
