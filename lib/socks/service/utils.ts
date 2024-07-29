import net, {Socket, TcpNetConnectOpts} from 'net';
import {CanConvertToBuffer, isNumber, isPlainObject, isRegExp, toBuffer} from './external';
import {
  SocksStatusOnServerSide,
  EMethod,
  MatchItem,
  SocksProxyConfig,
  TargetServiceInfo,
  TargetSocket,
  EAddressType,
} from './types';
import {isString, toUrlInstance, requestAndGetUpgradeInfo, startSocketClient} from './external';

export const upgradeProtocol = 'socks5';

export const MethodList = Object.values(EMethod).filter(v => isNumber(v));

export function getSocketInfo(socket?: Socket) {
  if (!socket) {
    return null;
  }
  const {localAddress, localPort, remoteAddress, remotePort, writable, readable, destroyed, closed} = socket;
  const local = `${localAddress}:${localPort}`;
  const remote = `${remoteAddress}:${remotePort}`;
  const id = [local, '<-', remote].join('');
  return {id, readable, writable, destroyed, closed, localAddress, localPort, remoteAddress, remotePort};
}

export const ERRORS = {
  InvalidSocksVersion: 'only socks version 5 supported',
  InvalidSchemaFormat: 'schema format is not correct',
  invalid_methods: 'all methods is not valid',
  IPv6NotSupported: 'ipv6 not supported',
  MethodCountNotCorrect: 'Count of METHODS is not equal to NMETHODS',
  username_password_auth_fail: 'username/password auth fail',
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

export class SocksError extends Error {
  moreInfo?: CanConvertToBuffer;
  constructor(message: string, moreInfo?: CanConvertToBuffer) {
    moreInfo = toBuffer(moreInfo);
    if (Buffer.isBuffer(moreInfo) && moreInfo.byteLength > 0) {
      message = `${message}: ${moreInfo.toString()}`;
    }
    super(message);
    this.moreInfo = moreInfo;
  }
}

export function createError(message: string, moreInfo?: CanConvertToBuffer) {
  return new SocksError(message, moreInfo);
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

export function targetServiceInfoToBuffer(targetServiceInfo: Omit<TargetServiceInfo, 'command'>): Buffer {
  const {address, port} = targetServiceInfo;
  let addressType = targetServiceInfo.addressType;
  if (!addressType) {
    addressType = getAddressType(address);
  }
  return toBuffer([addressType, address2Buffer(address), port2Buffer(port)]);
}

export function bufferToTargeServiceInfo(buf: Buffer): Required<Omit<TargetServiceInfo, 'command'>> {
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

export function getMatchedProxyConfig(
  target: TargetServiceInfo,
  config: SocksProxyConfig
): SocksProxyConfig | null {
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
      result &&= address === target.address;
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

export function getConnectStatusInJson(status?: SocksStatusOnServerSide) {
  if (!status) {
    return null;
  }
  const {socket, socket2Service, proxyAsClientStatus} = status;
  const results = {
    ...status,
    socket: getSocketInfo(socket),
  };
  if (socket2Service) {
    // @ts-ignore
    results.socket2Service = getSocketInfo(socket2Service);
  }
  // if (error) {
  //   results.error = {
  //     name: error.name,
  //     message: error.message,
  //     stack: error.stack,
  //   };
  // }
  if (proxyAsClientStatus) {
    // @ts-ignore
    results.proxyAsClientStatus = getConnectStatusInJson(proxyAsClientStatus);
  }
  return results;
}

// export async function checkPort(port: number) {
//   if (await checkPort(port)) {
//     throw new Error(`Port ${port}is alreay in use`);
//   }
// }

export async function getSocket(target: TargetSocket) {
  let socket: Socket;
  if (isPlainObject(target)) {
    socket = await startSocketClient(target as TcpNetConnectOpts);
  } else if (isString(target)) {
    const {socket: _socket} = await requestAndGetUpgradeInfo({
      url: target as string,
      headers: {
        Connection: 'Upgrade',
        Upgrade: upgradeProtocol,
      },
    });
    socket = _socket;
  } else {
    throw new Error(`Format of target is not correct`);
  }
  return socket;
}

export function getTargetServiceInfo(origin: TargetServiceInfo | string): TargetServiceInfo {
  if (isString(origin)) {
    const {hostname, port} = toUrlInstance({origin: origin as string});
    return {
      address: hostname,
      port: parseInt(port),
    };
  }
  return origin as TargetServiceInfo;
}
