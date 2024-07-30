import {TargetSocket} from './base';
import {MethodAuthInfo, TargetServiceInfo} from './v5';

interface SocksExtralConfigV5 {
  methodList?: Array<MethodAuthInfo>;
}
interface SocksExtralConfigV6 {
  ivBytes?: number;
  auth: {
    username: string;
    password: string;
  };
}

export interface CommonClientExchangeInfoConfig {
  /**
   * can be a origin/href/url
   */
  targetServiceInfo: TargetServiceInfo | string;
}

export interface SocksClientExchangeInfoConfigV5
  extends CommonClientExchangeInfoConfig,
    SocksExtralConfigV5 {}

export interface SocksClientExchangeInfoConfigV6
  extends CommonClientExchangeInfoConfig,
    SocksExtralConfigV6 {}

interface SocksClientExchangeInfoConfigMap {
  v5: SocksClientExchangeInfoConfigV5;
  v6: SocksClientExchangeInfoConfigV6;
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

interface CommonServerExchangeInfoConfig {
  proxyConfigList?: SocksProxyConfig[];
}

export interface SocksServerExchangeInfoConfigV5
  extends CommonServerExchangeInfoConfig,
    SocksExtralConfigV5 {}

export interface SocksServerExchangeInfoConfigV6
  extends CommonServerExchangeInfoConfig,
    SocksExtralConfigV6 {}
interface SocksServerExchangeInfoConfigMap {
  v5: SocksServerExchangeInfoConfigV5;
  v6: SocksServerExchangeInfoConfigV6;
}

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

export type SocksServerConfig<Version extends SocksVersion> = SocksServerExchangeInfoConfigMap[Version] & {
  // stateTracer: SocksClientStatus['stateTracer'];
  socksVersion: Version;
};
