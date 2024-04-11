import {requestAndGetResponseInfo} from './client';

export async function testRequestAndGetResponseInfo() {
  const {statusCode, data, headers} = await requestAndGetResponseInfo({
    url: 'http://elif.site/api/debug/:action',
    pathnameParams: {
      action: 'echo',
    },
    query: {
      ts: Date.now(),
    },
    method: 'post',
    headers: {
      'trace-id': 'abc'
    },
    data: {
      a: 1,
      b: 2,
    },
  });
  console.log({statusCode, data, headers});
}
