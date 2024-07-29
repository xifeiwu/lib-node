import {TcpNetConnectOpts} from 'net';
import {SocksClientStatus, SocksStatusOnServerSide} from './base';
import {MethodAuthInfo, SocksClientConfigV5} from './v5';

interface SocksClientConfigMap {
  v5: SocksClientConfigV5;
  // v6
}

export type SocksVersion = keyof SocksClientConfigMap;

// type T = SocksClientConfigMap['v5'];

// export interface  extends .v5 {

// }
export type SocketCommunicationConfig<Version extends SocksVersion> = SocksClientConfigMap[Version] & {
  stateTracer: SocksClientStatus['stateTracer'];
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
export interface SocksProxyConfig {
  matches: Array<MatchItem | string | RegExp>;
  socksVersion: SocksVersion;
  targetSocksServer: TargetSocket;
}

// export interface CommonServerConfig {
//   methodList: Array<MethodAuthInfo>;
//   /** proxy to other socks server */
//   proxyAsSocketClientConfigList?: SocksProxyConfig[];
//   /** on fail duration socks conversation */
//   onConnection: (status: SocksStatusOnServerSide) => void;
// }
