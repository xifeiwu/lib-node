/**
 * Port range:
 * 3000-3100: for testing code for net feature
 * 3100-3200: for stable service used by myself
 * 3200-3300: for service used for some specific case
 * For the value, the higher, the stable
 */
export const PORT = {
  httpProtocolExplorer: {
    port: 3130,
    description: 'Http protocol Explorer',
  },
  basicHttpServer: {
    port: 3160,
    description: 'For a http server with basic logic, such as test api',
  },
  assistConviva: {
    port: 3200,
    description: 'assist for development of assist server',
  },
};
