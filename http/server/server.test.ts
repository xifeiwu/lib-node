import assert from 'assert';
import {requestAndGetResponseInfo} from '../client';
import {startHttpServer} from './server';
import {responseHttpRequestInfo} from './receive';

export async function testResponseHttpRequestProps() {
  const {origin, server} = await startHttpServer({
    request: responseHttpRequestInfo,
  });
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
    pathname: '/Echo',
    headers: {
      TRACE_id: '123',
    },
    data: 'abc',
  });
  const {data} = responseInfo;
  /** convert to upper case for method name */
  assert.equal(data.method, 'POST');
  /** stay letter case of pathname */
  assert.equal(data.url, '/Echo');
  /** convert header field name to lower case */
  assert.equal(data.headers['trace_id'], '123');
  assert.equal(data.data, 'abc');
  console.log(responseInfo);
  server.close();
}
