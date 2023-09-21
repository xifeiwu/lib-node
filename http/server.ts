import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import stream from 'stream';
import {getStreamData} from '../stream';
import {fromBuffer, toBuffer} from '../transform';

export async function getHttpIncomingMessageInfo(request: http.IncomingMessage) {
  const {method, url, headers} = request;
  const data = fromBuffer(await getStreamData(request), 'json');
  return {
    method,
    url,
    headers,
    data,
  };
}
export async function responseHttpIncomingMessageInfo(
  request: http.IncomingMessage,
  response: http.ServerResponse
) {
  const data = await getHttpIncomingMessageInfo(request);
  const buffer = await toBuffer(data);
  const headers = {
    'content-type': 'application/json',
    'content-length': buffer.length,
  };
  Object.entries(headers).forEach(([key, value]) => {
    response.setHeader(key, value);
  });
  response.end(buffer);
}
