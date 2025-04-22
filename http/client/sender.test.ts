import {logColorful} from '../../log';
import {toReadable} from '../../stream';
import {DebugServerPathname, startHttpDebugServer} from '../server';
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

export async function testEmptyArray() {
  {
    const {origin, server} = await startHttpDebugServer();
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      method: 'post',
      origin,
      pathname: DebugServerPathname.echo,
      // data: toReadable({
      //   a: 1,
      //   b: true,
      // }),
      data: [],
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
    server.close();
  }
}
