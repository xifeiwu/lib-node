import dns from 'dns';
import net, {Socket, TcpNetConnectOpts, isIP} from 'net';
import {
  SocksServerInfo,
  MatchItem,
  TargetSocksServer,
  ProxyConfig,
  SocksClientInfo,
  SocksVersion,
} from '../types';
import {
  isString,
  toUrlInstance,
  requestAndGetUpgradeInfo,
  startSocketClient,
  CanConvertToBuffer,
  isNumber,
  isPlainObject,
  isRegExp,
  toBuffer,
  fromBuffer,
} from './external';
import {RequestTarget, StateTracer, TracerItem} from '../types/base';
import {
  EMethod,
  EAddressType,
  EHandleRequestTargetState,
  RequestTargetV5,
  RequestTargetResponseV5,
} from '../types/v5';

export const UPGRADE_PROTOCOL_SOCKS_PREFIX = 'scks-';

export const MethodList = Object.values(EMethod).filter(v => isNumber(v));

export const ERRORS = {
  InvalidSocksVersion: 'invalid socks version',
  InvalidSchemaFormat: 'schema format is not correct',
  invalid_methods: 'all methods is not valid',
  IPv6NotSupported: 'ipv6 not supported',
  MethodCountNotCorrect: 'Count of METHODS is not equal to NMETHODS',
  authUserPassFail: 'username/password auth fail',
  MORE_THAN_255_BYTES: 'size too long (limited to 255 bytes)',
  incorrect_address_type: 'addressType is not correct',
  CLIENT_AUTH_FAIL: 'userName/password not correct',
  INVALID_METHOD: 'method is invalid(NO_AUTH or USERNAME/PASSWORD)',
  InvalidSocksCommand:
    'An invalid SOCKS command was provided. Valid options are connect, bind, and associate.',
  InvalidSocksCommandForOperation:
    'An invalid SOCKS command was provided. Only a subset of commands are supported for this operation.',
  InvalidSocksClientOptionsDestination: 'An invalid destination host was provided.',
  InvalidSocksClientOptionsExistingSocket:
    'An invalid existing socket was provided. This should be an instance of stream.Duplex.',
  InvalidSocksClientOptionsProxy: 'Invalid SOCKS proxy details were provided.',
  InvalidSocksClientOptionsTimeout:
    'An invalid timeout value was provided. Please enter a value above 0 (in ms).',
  InvalidSocksClientOptionsProxiesLength: 'At least two socks proxies must be provided for chaining.',
  NegotiationError: 'Negotiation error',
  notFoundClientRequest: 'not found client request info',
  handleClientRequestFail: 'handle client request fail',
  connectionError: 'connection error',
  SocketClosed: 'Socket closed',
  SocketUnWritable: 'Socket can not write',
  ProxyConnectionTimedOut: 'Proxy connection timed out',
  InternalError: 'SocksClient internal error (this should not happen)',
  InvalidSocks4HandshakeResponse: 'Received invalid Socks4 handshake response',
  InvalidSocks5InitialHandshakeResponse: 'Received invalid Socks5 initial handshake response',
  InvalidSocks5IntiailHandshakeSocksVersion:
    'Received invalid Socks5 initial handshake (invalid socks version)',
  InvalidSocks5InitialHandshakeNoAcceptedAuthType:
    'Received invalid Socks5 initial handshake (no accepted authentication type)',
  InvalidSocks5InitialHandshakeUnknownAuthType:
    'Received invalid Socks5 initial handshake (unknown authentication type)',
  Socks5AuthenticationFailed: 'Socks5 Authentication failed',
  InvalidSocks5FinalHandshake: 'Received invalid Socks5 final handshake response',
  InvalidSocks5FinalHandshakeRejected: 'Socks5 proxy rejected connection',
  InvalidSocks5IncomingConnectionResponse: 'Received invalid Socks5 incoming connection response',
  Socks5ProxyRejectedIncomingBoundConnection: 'Socks5 Proxy rejected incoming bound connection',
  IPV4FormatNotCorrect: 'format of ipv4 address is not correct',
  proxyError: 'error while proxy to other socks server',
};

const COMMON_STATE = {
  catchError: 'catch error',
};
export const CLIENT_STATE = {
  ...COMMON_STATE,
  startConnectToSocksServer: 'start connect to socks server',
  startNegotiation: 'start negotiation',
  finishNegotiation: 'finsish negotiation with socks server',
};
export const SERVER_STATE = {
  ...COMMON_STATE,
  startHandleConnection: 'start handle connection',
  startNegotiation: 'start negotiation',
  waitingNegotiation: 'waiting negotiation',
  gotNegotiationInfo: 'got negotiation info',
  authSuccess: 'auth success',
  authFail: 'auth fail',
  sendRequestTargetResponse: 'send requestTarget response',
  handleConnectCommand: 'handle connect command',
  handleConnectCommandSuccess: 'handle connect command success',
  willProxyToRemoteSocksServer: 'will proxy connection to remote socks server',
  proxyToRemoteSocksServerSuccess: 'proxy to remote socks server success',
  remoteSocketClosed: 'remove socket closed',
  connectionError: 'connection error',
};

export class SocksError extends Error {
  moreInfo?: CanConvertToBuffer;
  constructor(message: string, moreInfo?: CanConvertToBuffer) {
    moreInfo = toBuffer(moreInfo);
    // if (Buffer.isBuffer(moreInfo) && moreInfo.byteLength > 0) {
    //   message = `${message}: ${moreInfo.toString()}`;
    // }
    super(message);
    this.moreInfo = moreInfo;
  }
}
export function createError(message: string, moreInfo?: CanConvertToBuffer) {
  return new SocksError(message, moreInfo);
}

export function serializeErrorInfo(err: Error): {
  message: string;
  stack: string;
  moreInfo?: string | object;
} {
  if (!(err instanceof Error)) {
    return;
  }
  const {message, stack} = err;
  let result: {
    message: string;
    stack: string;
    moreInfo?: string | object;
  } = {message, stack};
  if (err instanceof SocksError) {
    const {moreInfo} = err;
    if (moreInfo) {
      result.moreInfo = fromBuffer(moreInfo, 'json') as object;
    }
  }
  return result;
}

export function getAddressType(host: string): EAddressType {
  const type = net.isIP(host);
  if (type === 4) {
    return EAddressType.IPV4;
  } else if (type === 6) {
    return EAddressType.IPV6;
  }
  return EAddressType.DOMAINNAME;
}

function address2Buffer(address: string, addressType?: EAddressType) {
  if (!addressType) {
    addressType = getAddressType(address);
  }
  if (addressType === EAddressType.IPV4) {
    const nums = address.split('.', 4);
    const bytes = new Array(4);
    for (let i = 0; i < 4; ++i) {
      if (isNaN((bytes[i] = +nums[i]))) {
        throw new Error('Error parsing IP: ' + address);
      }
    }
    return Buffer.from(bytes);
  } else if (addressType === EAddressType.IPV6) {
    throw new Error(`ipv6 not support yet`);
  } else if (addressType === EAddressType.DOMAINNAME) {
    const length = address.length;
    if (length > 255) {
      throw createError(ERRORS.MORE_THAN_255_BYTES);
    }
    return toBuffer([length, address]);
  }
}
function port2Buffer(port: number) {
  const high = (port >> 8) & 0xff;
  const low = port & 0xff;
  return toBuffer([high, low]);
}

export function targetServiceInfoToBuffer(targetServiceInfo: Omit<RequestTargetV5, 'command'>): Buffer {
  const {address, port} = targetServiceInfo;
  let addressType = targetServiceInfo.addressType;
  if (!addressType) {
    addressType = getAddressType(address);
  }
  return toBuffer([addressType, address2Buffer(address), port2Buffer(port)]);
}

export function bufferToTargeServiceInfo(buf: Buffer): Required<Omit<RequestTargetV5, 'command'>> {
  const [addressType] = buf;
  const remainBuffer = buf.subarray(1);
  if (!Object.values(EAddressType).includes(addressType)) {
    throw createError(ERRORS.incorrect_address_type);
  }
  let address: string;
  let port: number;
  if (addressType === EAddressType.DOMAINNAME) {
    // const [domainLength] = others;
    const domainLength = remainBuffer[0];
    let startIndex = 1;
    const domainBuf = remainBuffer.subarray(startIndex, startIndex + domainLength);
    startIndex += domainLength;
    if (startIndex >= remainBuffer.byteLength) {
      throw createError(ERRORS.InvalidSchemaFormat);
    }
    const portBuf = remainBuffer.subarray(startIndex, startIndex + 2);
    address = domainBuf.toString();
    port = (portBuf[0] << 8) + portBuf[1];
    // console.log(address, port);
  } else if (addressType === EAddressType.IPV4) {
    const domainBuf = remainBuffer.subarray(0, 4);
    const portBuf = remainBuffer.subarray(4, 6);
    address = Array.prototype.join.call(domainBuf, '.');
    port = (portBuf[0] << 8) + portBuf[1];
  }
  return {addressType, address, port};
}

export async function getInfoFromFirstChunk(reader: Socket) {
  reader.resume();
  return new Promise<{
    protocol: 'http' | 'socks5' | null;
    firstLine: string;
    chunk: Buffer;
  }>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      const str = chunk.toString();
      let protocol: 'http' | 'socks5' | null = null;
      const firstLine = str.split(/[\r\n]+/)[0];
      if (/^([a-z]+?)\s([^\s]+)\s(http\/\d\.\d)$/i.test(firstLine)) {
        protocol = 'http';
      } else if (0x05 === chunk[0]) {
        protocol = 'socks5';
      }
      res({
        protocol,
        firstLine,
        chunk,
      });
    });
  });
}

export function getMatchedProxyConfig(target: RequestTargetV5, config: ProxyConfig): ProxyConfig | null {
  const {matches = []} = config;
  const matched = matches.find(match => {
    /**
     * if match is string | RegExp, it will match against address
     */
    let address: string | RegExp = match as string | RegExp;
    let port: number;
    if (isPlainObject(match)) {
      address = (match as MatchItem).address;
      port = (match as MatchItem).port;
    }
    let result = true;
    if (isRegExp(address)) {
      result &&= (address as RegExp).test(target.address);
    } else if (isString(address)) {
      result &&= target.address.includes(address as string);
    } else {
      result = false;
    }
    if (isNumber(port)) {
      result &&= port === target.port;
    }
    return result;
  });
  if (matched) {
    return config;
  }
  return null;
}

export function toRequestTargetV5(
  requestTarget: RequestTarget,
  command?: RequestTargetV5['command']
): RequestTargetV5 {
  let result: RequestTargetV5;
  if (isString(requestTarget)) {
    const url = toUrlInstance({origin: requestTarget as string});
    const {protocol, hostname} = url;
    let port = protocol === 'https:' ? 443 : protocol === 'http:' ? 80 : 0;
    if (url.port) {
      port = parseInt(url.port);
    }
    result = {
      address: hostname,
      port,
    };
  } else {
    result = requestTarget as RequestTargetV5;
  }
  if (command) {
    result.command = command;
  }
  return result;
}

export function pushState(item: TracerItem, stateTracer?: StateTracer) {
  if (!Array.isArray(stateTracer)) {
    return false;
  }
  return stateTracer.push(item);
}

/**
 * connect to requestTarget from local node runtime
 * @param requestTarget
 * @returns
 */
export async function connectFromLocal(requestTarget: RequestTargetV5): Promise<{
  socket: Socket;
  requestTargetResponse: RequestTargetResponseV5;
}> {
  let {address, port} = toRequestTargetV5(requestTarget);
  let addressType: EAddressType = getAddressType(address);
  const isDomain = isIP(address) === 0;
  let state: 'dns' | 'connection' = 'dns';
  let socket: Socket;
  let reply: EHandleRequestTargetState = EHandleRequestTargetState.succeeded;
  try {
    if (isDomain) {
      const ip = await new Promise<string>((resolve, reject) => {
        dns.lookup(address, function (err, ip) {
          if (err) {
            reject(err);
          } else {
            resolve(ip);
          }
        });
      });
      address = ip;
      addressType = getAddressType(ip);
    }
    state = 'connection';
    socket = await new Promise((res, rej) => {
      const socket = new Socket();
      socket.once('connect', () => {
        res(socket);
      });
      socket.once('error', err => {
        rej(EHandleRequestTargetState.general_SOCKS_server_failure);
      });
      socket.once('timeout', err => {
        rej(EHandleRequestTargetState.TTL_expired);
      });
      socket.connect({
        host: address,
        port: port,
      });
    });
  } catch (err) {
    const blockByDns = state === 'dns';
    reply = blockByDns
      ? EHandleRequestTargetState.Host_unreachable
      : isString(err)
      ? EHandleRequestTargetState.general_SOCKS_server_failure
      : EHandleRequestTargetState.Connection_refused;
  }
  return {
    socket,
    requestTargetResponse: {
      reply,
      address,
      port,
      addressType,
    },
  };
}

/**
 * Can optionally set socksVersion as part of protocol or not
 * If socksVersion set in protocol part, server will use it as socksVersion with high priority
 * Else will use firstByte of firstChunk as socksVersion
 * @param target
 * @param socksVersion
 * @returns
 */
export async function getSocketToSocksServer(target: TargetSocksServer, socksVersion?: SocksVersion) {
  let socket: Socket;
  if (isString(target)) {
    const result = await requestAndGetUpgradeInfo({
      href: target as string,
      headers: {
        upgrade: UPGRADE_PROTOCOL_SOCKS_PREFIX + (socksVersion ?? ''),
      },
    });
    socket = result.socket;
  } else {
    socket = await startSocketClient(target as TcpNetConnectOpts);
  }
  return socket;
}

const MAX_WAIT_TIME = 20 * 1000;
export function listenTimeOut(cb: (err: Error) => void, options?: {waitMs?: number; errMessage?: string}) {
  const {waitMs = MAX_WAIT_TIME, errMessage = 'time out'} = options ?? {};
  const timeoutTag = setTimeout(() => {
    cb(new Error('time out: ' + errMessage));
  }, waitMs);
  return timeoutTag;
}

export function serializableSocksClientInfo(info?: SocksClientInfo) {
  if (!info) {
    return undefined;
  }
  const {socket, ...rest} = info;
  return {...rest};
}
export function serializableSocksServerInfo(info: SocksServerInfo) {
  const {socket, socket2Remote, error, socksClientInfo, ...rest} = info;
  return {
    error: error ? serializeErrorInfo(error) : undefined,
    ...rest,
    socksClientInfo: serializableSocksClientInfo(socksClientInfo),
  };
}
export function simplifySocksServerInfo(info: SocksServerInfo) {
  const {error, negotiationResult, stateTracer, socksVersion} = serializableSocksServerInfo(info);
  const {requestTarget, requestTargetResponse} = negotiationResult ?? {};
  return {
    error,
    requestTargetResponse,
    requestTarget,
    stateTracer,
    socksVersion,
  };
}

export function isSocksProtocol(firstByte: number | string) {
  const socksVersion: SocksVersion[] = [1, 5];
  return socksVersion.some(it => {
    return String(it) === String(firstByte);
  });
}
