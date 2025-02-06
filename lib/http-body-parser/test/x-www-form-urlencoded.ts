import {startHttpDebugServer, requestAndGetResponseInfo, toFormUrlencoded} from '../service/external';

/**
 * http module will not handle payload by content-type setted
 */
export async function contentType() {
  const {origin, server} = await startHttpDebugServer();
  const data = toFormUrlencoded({a: 1, b: true});
  {
    const responseInfo = await requestAndGetResponseInfo({
      origin,
      pathname: '/api/debug/echo',
      method: 'post',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      data,
    });
    console.log(responseInfo);
  }
  server.close();
}
