import http from 'http';
import {createHash} from 'crypto';
import {IncomingMessage} from 'http';
import {Duplex} from 'stream';
import {parseHttpBody, HttpBodyParserOptions} from '../../../lib/http-body-parser';
import {
  HttpRequestInfo,
  GetIncomingMessageHeader,
  HttpResponseInfo,
  HttpRequestHeaderPartInfo,
} from '../../../types';

export const getHttpRequestHeaderPartInfo: GetIncomingMessageHeader<'server'> = (
  request: IncomingMessage
) => {
  const {method, url, httpVersion, headers} = request;
  return {method, url, httpVersion, headers};
};

export async function getHttpRequestInfo<DataType = any>(
  incomingMessage: http.IncomingMessage,
  bodyParserOptions?: HttpBodyParserOptions
): Promise<HttpRequestInfo<DataType>> {
  const data = await parseHttpBody(incomingMessage, bodyParserOptions);
  const results = {
    ...getHttpRequestHeaderPartInfo(incomingMessage),
    data,
  };
  return results;
}

export function getUpgradeProtocol(req: IncomingMessage) {
  const {upgrade, connection} = req.headers;
  if (connection.toLocaleLowerCase() !== 'upgrade') {
    throw new Error(`connection should be upgrade`);
  }
  if (upgrade === undefined) {
    throw new Error(`upgrade should be set`);
  }
  return upgrade;
}
export function getUpgradeResponse(protocol: string, info?: HttpResponseInfo) {
  const {headers, ...restInfo} = info ?? {};
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 101,
    statusMessage: 'Switching Protocols',
    headers: {
      Upgrade: protocol,
      Connection: 'Upgrade',
      ...(headers ?? {}),
    },
    ...(restInfo ?? {}),
  };
  return responseInfo;
}

export const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
export function handleWebsocketUpgrade(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): HttpResponseInfo {
  const {headers} = req;
  if (headers === undefined) {
    throw new Error(`Not found headers`);
  }
  const key = headers['sec-websocket-key'];
  if (key === undefined) {
    throw new Error(`sec-websocket-key is not found on header part`);
  }
  const digest = createHash('sha1')
    .update(key + GUID)
    .digest('base64');
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 101,
    statusMessage: 'Switching Protocols',
    headers: {
      Upgrade: 'websocket',
      Connection: 'Upgrade',
      'Sec-WebSocket-Accept': digest,
    },
  };
  return responseInfo;
}

/**
 * Default way of handle connect event
 */
export function handleConnectEvent(
  req: IncomingMessage,
  socket?: Duplex,
  head?: Buffer
): {requestHeaderPartInfo: HttpRequestHeaderPartInfo<'receiver'>; responseInfo: HttpResponseInfo} {
  const requestHeaderPartInfo = getHttpRequestHeaderPartInfo(req);
  const responseInfo: HttpResponseInfo = {
    httpVersion: 'HTTP/1.1',
    statusCode: 200,
    statusMessage: 'Connection Established',
  };
  return {requestHeaderPartInfo, responseInfo};
}
