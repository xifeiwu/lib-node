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
  if4Pulse: {
    port: 3201,
    description: 'assist for development of instant filter server'
  }
}