/**
 * Port Range:
 * [3000, 3100): for net feature explore
 * [3100, 3200): for stable self service
 * [3200, 3300): for stable third-party service
 */
export const PORT: {
  [key: string]: {
    port: number;
    description: string;
  };
} = {
  /** Start: for net feature explore */
  tmpMemcached: {
    port: 3099,
    description: 'tmp port for memcached',
  },
  /** End: for net feature explore */
  /** Start: for stable self service */
  // explorerHttpProtocol: {
  //   port: 3130,
  //   description: 'Http protocol Explorer',
  // },
  basicHttpServer: {
    port: 3160,
    description: 'For a http server with basic logic, such as test api',
  },
  /** End: for stable service used by myself */

  /** Start: for stable third-party service */
  assistConviva: {
    port: 3200,
    description: 'assist for development of assist server',
  },
  convivaDockerEnv: {
    port: 3220,
    description: 'assist for development of assist server',
  },
  /** End: for stable third-party service */
};
