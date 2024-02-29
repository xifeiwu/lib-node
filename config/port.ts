/**
 * Port range:
 * 3000-3100: for testing code for net feature
 * 3100-3200: for stable service used by myself
 * 3200-3300: for service used for some specific case
 */
export const PORT = {
  basicHttpServer: {
    port: 3180,
    description: 'for a http server with basic logic, such as test api',
  },
  // netFeature: {
  //   port: 3100,
  //   description: 'show feature of net related logic, include http, websocket, socks5, etc'
  // },
  assistConviva: {
    port: 3200,
    description: 'assist for development of assist server'
  },
};
