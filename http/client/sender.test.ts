import {logColorful} from '../../log';
import {toReadable} from '../../stream';
import {requestAndGetResponseInfo} from './sender';

export async function testRequestAndGetResponseInfo() {
  {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      method: 'post',
      origin: 'http://elif.site',
      pathname: '/api/debug/echo',
      data: toReadable({
        a: 1,
        b: true,
      }),
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
  }
}
