import {CommonClientExchangeInfoConfig, TargetSocket} from './base';
import {MethodAuthInfo} from './v5';

export interface SocksServerConfigV5 {
  methodList?: Array<MethodAuthInfo>;
}
export interface SocksClientExchangeInfoConfigV5 extends CommonClientExchangeInfoConfig, SocksServerConfigV5 {}

interface SocksClientExchangeInfoConfigMap {
  v5: SocksClientExchangeInfoConfigV5;
  // v6
}

export type SocksVersion = keyof SocksClientExchangeInfoConfigMap;

export type SocksClientConfig<Version extends SocksVersion> = SocksClientExchangeInfoConfigMap[Version] & {
  socksVersion: Version;
  /** target socks server */
  targetSocksServer: TargetSocket;
};

// export type SocksClientConfig<Version extends SocksVersion> = SocksClientConfigMap[Version] & {
//   socksVersion: Version;
// };

export interface MatchItem {
  address: string;
  port: number;
}
/**
 * can be a socket config or http href
 */
/** proxy to another socks server when address/port meets condition in matches list */
export type SocksProxyConfig<Version extends SocksVersion = 'v5'> = {
  matches: Array<MatchItem | string | RegExp>;
} & Omit<SocksClientConfig<Version>, 'targetServiceInfo'>;

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
