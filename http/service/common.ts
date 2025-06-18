import {Env} from '../../external';
import {HttpServerConfig} from '../../types';
import {getDefaultTlsConfig} from '../../net';

export function getDefaultHttpsConfig(options?: {env?: Env}): HttpServerConfig {
  const {env = process.env.NODE_ENV} = options ?? {};
  const tlsOptions = getDefaultTlsConfig();
  if (env === Env.elif) {
    return {
      host: '0.0.0.0',
      port: 443,
      options: tlsOptions,
    };
  } else {
    return {
      host: '0.0.0.0',
      port: 4443,
      options: tlsOptions,
    };
  }
}
