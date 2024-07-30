const commonState = {
  // initial: 'initial',
  finishedProcess: 'finish process',
  logicError: 'logic error',
  connectionError: 'connection error',
};
export const clientState = {
  ...commonState,
  // connectToSocksServer: 'start connect to socks server',
  methodNegotiation: 'start method negotiation',
  finishMethodNegotiation: 'finish method negotiation',
  authUserPass: 'start auth username/password',
  authUserPassSuccess: 'auth username/password success',
  sendTargetSericeInfo: 'send target service info',
  getRepliedTargetSericeInfo: 'get replied target service info',
};

export const serverState = {
  ...commonState,
  waitingMethodList: 'waiting for method list',
  repliedMethod: 'replied method',
  waitingAuthUserPass: 'waiting for auth username/password',
  authUserPassFail: 'auth by username/password fail',
  authUserPassSuccess: 'auth by username/password success',
  waitingTargetServiceInfo: 'waiting for target service info',
  gotTargetServiceInfo: 'got target service info',
  startTransferDomainToIp: 'start transfer domain to ip',
  connectToTargetServiceSuccess: 'connect to target service success',
  repliedTargetServiceInfo: 'replied target service info',
  connectionError: 'connection error',
  client_socket_unwritable: 'origin socket unwritable',
  target_socket_unwritable: 'target socket unwritable',
};
