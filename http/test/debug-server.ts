import assert from 'assert';
import {requestAndGetResponseInfo} from '../client';
import {startHttpDebugServer} from '../server';
import {CustomizeResponseOptions, HttpServerConfig} from '../../types';
import {getDefaultHttpsConfig} from '../service';
import {sendHttpRequestByTcp} from '../tcp';
import {getDataFromReadable} from '../../stream';
import {logColorful} from '../../log';
import {HttpDebugServerPath, isString} from '../../external';

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
    pathname: HttpDebugServerPath.echo,
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
  assert.equal(data.url, HttpDebugServerPath.echo);
  /** format of field name of headers is lower case */
  assert.equal(data.headers['trace_id'], '123');
  /** payload from server response is deepEqual with data from client side */
  assert.deepEqual(data.data, payload);
  console.log(responseInfo);
  server.close();
}

export async function testCustomRespnse() {
  const {origin, server} = await startHttpDebugServer();
  const customized: CustomizeResponseOptions = {
    statusCode: 405,
    data: {
      a: 'a',
      b: 1,
      c: true,
    },
  };
  const {responseInfo} = await requestAndGetResponseInfo<any, CustomizeResponseOptions>({
    method: 'post',
    origin,
    pathname: HttpDebugServerPath.customResponse,
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

/**
 * Show structure of response when body is empty
 */
export async function testEmpty() {
  const {origin, server} = await startHttpDebugServer();
  for (const pathname of [HttpDebugServerPath.empty, HttpDebugServerPath.echo]) {
    const client = await sendHttpRequestByTcp({
      origin,
      pathname,
    });
    const response = await getDataFromReadable(client);
    logColorful({}, '--start--');
    logColorful({}, response);
    logColorful({}, '--end--');
  }
  server.close();
}
