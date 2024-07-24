import {Socket} from 'net';
import {isNumber, isPlainObject, checkPort, isRegExp} from '../external';
import {
  SocksStatusOnServerSide,
  EMethod,
  ESocksState,
  MatchItem,
  ProxyAsSocksClientConfig,
  TargetServiceInfo,
} from './types';
import {isString} from '../../external';

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
  config: ProxyAsSocksClientConfig
): ProxyAsSocksClientConfig | null {
  const {matches = [], ...clientConfig} = config;
  const matched = matches.find(match => {
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

/**
 * @deprecated maybe not used
 * @param lastState
 * @returns
 */
export function getFailState(lastState: ESocksState) {
  let failState: ESocksState;
  switch (lastState) {
    case ESocksState.connecting:
      failState = ESocksState.connect_fail;
      break;
    case ESocksState.method_negotiation:
      failState = ESocksState.method_negotiation_fail;
      break;
    case ESocksState.auth_username_password_start:
      failState = ESocksState.auth_username_password_fail;
      break;
    case ESocksState.send_request_info:
      failState = ESocksState.send_request_info_fail;
      break;
    case ESocksState.connect_to_targer_service:
      failState = ESocksState.connect_to_targer_service_fail;
      break;
  }
  return failState;
}

export function getConnectStatusInJson(status?: SocksStatusOnServerSide) {
  if (!status) {
    return null;
  }
  const {error, socket, socket2Service, proxyAsClientStatus} = status;
  const results = {
    ...status,
    socket: getSocketInfo(socket),
  };
  if (socket2Service) {
    // @ts-ignore
    results.socket2Service = getSocketInfo(socket2Service);
  }
  if (error) {
    results.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  if (proxyAsClientStatus) {
    // @ts-ignore
    results.proxyAsClientStatus = getConnectStatusInJson(proxyAsClientStatus);
  }
  return results;
}

export async function checkPort(port: number) {
  if (await checkPort(port)) {
    throw new Error(`Port ${port}is alreay in use`);
  }
}
