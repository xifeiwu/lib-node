import {Socket} from 'net';
import {ServerConfig as ServerConfigV5} from './v5';
import {ServerConfig as ServerConfigVc1} from './vc1';
import {NegotiationResult, SocksClientConfig, SocksClientStatus, SocksVersion} from './client';

interface ServerConfig {
  v5: ServerConfigV5;
  vc1: ServerConfigVc1;
}

export type SocksServerConfig<Version extends SocksVersion> = ServerConfig[Version] & {
  socksVersion: Version;
  proxyConfigList?: Array<ProxyConfig>;
};

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

export type ProxyConfig = SocksProxyConfig<'v5'> | SocksProxyConfig<'vc1'>;

export type NegotiationWithClient<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientStatus
) => Promise<NegotiationResult[Version]>;

export type ConnectToTargetServerFunc<Version extends SocksVersion> = (
  socket: Socket,
  config: SocksServerConfig<Version>,
  clientInfo: SocksClientStatus
) => Promise<{
  socket: Socket;
  proxyClientStatus?: SocksClientStatus;
}>;
