
const commonState = {
  initial: 'initial',
  // success: 'success',
  finsihProcess: 'finish process',
  logicError: 'logic error',
  connectionError: 'connection error',
};
export const clientState = {
  ...commonState,
  /** client only */
  connectToSocksServer: 'start connect to socks server',
  // connectSocksServerSuccess: 'connect to socks server success',
  // connectSocksServerFail: 'connect to socks server fail',
  methodNegotiation: 'start method negotiation',
  finishMethodNegotiation: 'finish method negotiation',
  // methodNegotiationFail: 'method negotiation fail',
  authUserPass: 'start auth username/password',
  authUserPassSuccess: 'auth username/password success',
  // authUserPassFail: 'auth username/password fail',
  /** client only */
  sendTargetSericeInfo: 'send target service info',
  receivedTargetSericeInfo: 'received target service info',
  // receiveTargetSericeInfoFail: 'send target service info fail',
  // receive_request_info_success: 'received request info success',
  /** end of client only */
  /** server only */
};

export const serverState = {
  ...commonState,
  waitingMethodList: 'waiting for method list',
  replyMethod: 'reply method',
  waitingTargetServiceInfo: 'waiting for target service info',
  waitingAuthUserPass: 'waiting for auth username/password',
  connectToTargerService: 'start connect to target service',
  repliedTargetServiceInfo: 'replied target service info',
  // connectToTargerServiceSuccess: 'connect target service success',
  // connectToTargerServiceFail: 'connect target service fail',
  socket2ServiceClosed: 'socket to service closed',
  socket2ServiceError: 'socket to service error',
  connectionError: 'connection error',
  client_socket_unwritable: 'origin socket unwritable',
  target_socket_unwritable: 'target socket unwritable',
};
