import fs from 'fs';
import path from 'path';
import {parseBody} from '..';
import {startHttpServer} from '../../../http/server';
import {toBuffer} from '../service/external';
import {FormFile, NodeFormData} from '../../../types';
import {formDataToBuffer} from '../../../http/form-data';
import {requestAndGetResponseInfo} from '../../../http/client';
import {logColorful} from '../../../log';
import {ParserOptions} from '../service/types';

async function startServer(parseOptions?: Partial<ParserOptions>) {
  return await startHttpServer({
    request: async (request, response) => {
      try {
        const data = await parseBody(request, {
          uploadDir: path.resolve(__dirname, 'uploads'),
          ...(parseOptions ?? {}),
        });
        response.statusCode = 200;
        response.end(toBuffer(data));
      } catch (err) {
        console.log(err);
        const {writable, destroyed} = response;
        if (writable) {
          response.statusCode = 500;
          const content = err?.message ? err.message : 'unknown server error';
          response.end(content);
        }
      }
    },
  });
}

export async function formData(parseOptions?: Partial<ParserOptions>) {
  const {origin, host, port, server} = await startServer(parseOptions);
  const formData: NodeFormData = {
    a: 1,
    file1: new FormFile(path.resolve(__filename)),
  };
  const {headers, reader} = await formDataToBuffer(formData, {chunkedTransfer: false});
  const responseInfo = await requestAndGetResponseInfo({
    origin,
    pathname: '/api/debug/echo',
    method: 'post',
    headers,
    data: reader,
  });
  console.log(responseInfo);
}

export async function json(parseOptions?: Partial<ParserOptions>) {
  const {origin, host, port, server} = await startServer(parseOptions);
  const data = {
    a: 1,
    b: true,
    c: 'str',
    d: {
      e: new Date(),
      f: Buffer.alloc(6).fill('f'),
    },
  };
  const responseInfo = await requestAndGetResponseInfo({
    origin,
    pathname: '/api/debug/echo',
    method: 'post',
    data,
    // headers: {
    //   'content-type': 'application/json',
    // },
  });
  logColorful({}, responseInfo);
}

export async function octet(parseOptions?: Partial<ParserOptions>) {
  const {origin, host, port, server} = await startServer(parseOptions);
  const data = {
    a: 1,
    b: true,
    c: 'str',
    d: {
      e: new Date(),
      f: Buffer.alloc(6).fill('f'),
    },
  };
  const responseInfo = await requestAndGetResponseInfo({
    origin,
    pathname: '/api/debug/echo',
    method: 'post',
    data,
    headers: {
      'content-type': 'application/octet-stream',
      'x-file-name': 'payload.ts',
    },
  });
  logColorful({}, responseInfo);
}

export async function octetReadable(parseOptions?: Partial<ParserOptions>) {
  const {origin, host, port, server} = await startServer(parseOptions);
  const data = fs.createReadStream(path.resolve(__dirname, 'basic-flow.ts'));
  const responseInfo = await requestAndGetResponseInfo({
    origin,
    pathname: '/api/debug/echo',
    method: 'post',
    data,
    headers: {
      'content-type': 'application/octet-stream',
      'x-file-name': 'payload.ts',
    },
  });
  logColorful({}, responseInfo);
}
