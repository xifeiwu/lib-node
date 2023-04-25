export const PORT: {
  [key: string]: {
    port: number;
    description: string;
  }
} = {
  netFeature: {
    port: 3100,
    description: 'show feature of net related logic, include http, websocket, socks5, etc'
  },
  assistConviva: {
    port: 3200,
    description: 'assist for development of assist server'
  },
  proxy2Turtle: {
    port: 3201,
    description: 'proxy server for pulser-turtle'
  },
  proxy2App: {
    port: 3202,
    description: 'proxy server for pulser-app'
  }
}