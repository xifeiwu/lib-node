import {TcpNetConnectOpts} from 'net';
import {SocksClientStatus, SocksServerStatus} from './base';
import {MethodAuthInfo, SocksClientConfigV5, SocksServerConfigV5} from './v5';

interface SocksClientConfigMap {
  v5: SocksClientConfigV5;
  // v6
}

export type SocksVersion = keyof SocksClientConfigMap;

export type SocketClientCommConfig<Version extends SocksVersion> = SocksClientConfigMap[Version] & {
  // stateTracer: SocksClientStatus['stateTracer'];
};

export type SocketClientConfig<Version extends SocksVersion> = SocksClientConfigMap[Version] & {
  socksVersion: Version;
  targetSocksServer: TargetSocket;
};

export interface MatchItem {
  address: string;
  port: number;
}
/**
 * can be a socket config or http href
 */
export type TargetSocket = TcpNetConnectOpts | string;
/** proxy to another socks server when address/port meets condition in matches list */
export type SocksProxyConfig<Version extends SocksVersion = 'v5'> = {
  matches: Array<MatchItem | string | RegExp>;
} & Omit<SocketClientConfig<Version>, 'targetServiceInfo'>;

interface SocksServerConfigMap {
  v5: SocksServerConfigV5;
}
export type SocksServerConfig<Version extends SocksVersion> = SocksServerConfigMap[Version] & {
  // stateTracer: SocksClientStatus['stateTracer'];
  socksVersion: Version;
  proxyConfigList?: SocksProxyConfig[];
};
// export interface CommonServerConfig {
//   methodList: Array<MethodAuthInfo>;
//   /** proxy to other socks server */
//   proxyAsSocketClientConfigList?: SocksProxyConfig[];
//   /** on fail duration socks conversation */
//   onConnection: (status: SocksStatusOnServerSide) => void;
// }
