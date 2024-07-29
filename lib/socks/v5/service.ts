const commonState = {
  initial: 'initial',
  finishedProcess: 'finish process',
  logicError: 'logic error',
  connectionError: 'connection error',
};
export const clientState = {
  ...commonState,
  connectToSocksServer: 'start connect to socks server',
  methodNegotiation: 'start method negotiation',
  finishMethodNegotiation: 'finish method negotiation',
  authUserPass: 'start auth username/password',
  authUserPassSuccess: 'auth username/password success',
  sendTargetSericeInfo: 'send target service info',
  receivedTargetSericeInfo: 'received target service info',
};

export const serverState = {
  ...commonState,
  waitingMethodList: 'waiting for method list',
  replyMethod: 'reply method',
  waitingTargetServiceInfo: 'waiting for target service info',
  waitingAuthUserPass: 'waiting for auth username/password',
  connectToTargerService: 'start connect to target service',
  repliedTargetServiceInfo: 'replied target service info',
  socket2ServiceClosed: 'socket to service closed',
  socket2ServiceError: 'socket to service error',
  connectionError: 'connection error',
  client_socket_unwritable: 'origin socket unwritable',
  target_socket_unwritable: 'target socket unwritable',
};
