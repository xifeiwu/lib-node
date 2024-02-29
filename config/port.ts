export const PORT: {
  [key: string]: {
    port: number;
    description: string;
  }
} = {
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
