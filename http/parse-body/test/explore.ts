import path from 'path';
import {parseBody} from '..';
import {startHttpServer} from '../../server';
import {startSocketClient} from '../../../net';
import {toBuffer} from '../service/external';
import {FormFile, NodeFormData} from '../../../types';
import {formDataToBuffer} from '../../form-data';
import {requestAndGetResponseInfo} from '../../client';
import {logColorful} from '../../../log';

async function startServer() {
  return await startHttpServer({
    request: async (request, response) => {
      try {
        const data = await parseBody(request, {
          uploadDir: path.resolve(__dirname, 'uploads'),
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

export async function formData() {
  const {origin, host, port, server} = await startServer();
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

export async function json() {
  const {origin, host, port, server} = await startServer();
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
