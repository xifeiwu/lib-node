export * from './cipher';

export const VERSION = 1;

export const clientState = {
  sentConnectionInfo: 'sent connection info',
  gotRepliedTargetServiceInfo: 'got replied target service info',
};

export const serverState = {
  waitingConnectionInfo: 'wait connection info',
  gotConnectionInfo: 'got connection info',
  authSuccess: 'auth success',
  authFail: 'auth fail',
  handleRequest: 'handle request from socks client',
  repliedTargetServiceInfo: 'replied target service info',
};
