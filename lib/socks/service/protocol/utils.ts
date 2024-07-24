import net from 'net';
import {TargetServiceInfo, EAddressType} from './types';
import {toBuffer} from '../../external';

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
  proxy_error: 'error while proxy to other socks server',
};

export function createError(message: string) {
  return new Error(message);
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
      if (isNaN((bytes[i] = +nums[i]))) { throw new Error('Error parsing IP: ' + address); }
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
