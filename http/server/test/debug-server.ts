import assert from 'assert';
import {requestAndGetResponseInfo} from '../../client';
import {DebugServerPathname, startHttpDebugServer} from '../server';
import {CustomResponseOptions, HttpServerConfig} from '../../../types';
import {getDefaultHttpsConfig} from '../../service';
import {isString} from 'markdown-it/lib/common/utils';

process.on('uncaughtException', function (err) {
  console.log('uncaughtException:');
  console.log(err.stack);
});
export async function testResponseHttpRequestProps() {
  const useTls = true;
  let config: HttpServerConfig;
  if (useTls) {
    config = getDefaultHttpsConfig();
  }
  const {origin, server} = await startHttpDebugServer(config);
  const payload = {
    a: 'a',
    b: 1,
    c: true,
  };
  const {responseInfo} = await requestAndGetResponseInfo<{
    method: string;
    url: string;
    headers: {
      trace_id: string;
    };
    data: string;
  }>({
    method: 'post',
    origin,
    pathname: DebugServerPathname.echo,
    headers: {
      TRACE_id: '123',
    },
    data: payload,
  });
  const {data} = responseInfo;
  /** for http info represented by node http module */
  /** format of method name upper case  */
  assert.equal(data.method, 'POST');
  /** format of url is the same as param of url from client side */
  assert.equal(data.url, DebugServerPathname.echo);
  /** format of field name of headers is lower case */
  assert.equal(data.headers['trace_id'], '123');
  /** payload from server response is deepEqual with data from client side */
  assert.deepEqual(data.data, payload);
  console.log(responseInfo);
  server.close();
}

export async function testCustomRespnse() {
  const {origin, server} = await startHttpDebugServer();
  const customized: CustomResponseOptions = {
    statusCode: 405,
    data: {
      a: 'a',
      b: 1,
      c: true,
    },
  };
  const {responseInfo} = await requestAndGetResponseInfo<any, CustomResponseOptions>({
    method: 'post',
    origin,
    pathname: DebugServerPathname.customResponse,
    data: {
      // delayMs: 6000,
      statusCode: customized.statusCode,
      headers: {
        TRACE_id: '123',
      },
      data: customized.data,
    },
  });
  const {statusCode, headers, data} = responseInfo;
  assert.equal(statusCode, customized.statusCode);
  assert.equal(headers['trace_id'], '123');
  assert.deepEqual(data, customized.data);
  server.close();
}

export async function test404() {
  const {origin, server} = await startHttpDebugServer();
  const {responseInfo} = await requestAndGetResponseInfo({
    origin,
    pathname: '/api/not-exist',
  });
  assert.equal(responseInfo.statusCode, 404);
  assert(isString(responseInfo.data));
  server.close();
}
