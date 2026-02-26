import assert from 'assert';
import {HttpDebugServerPath} from '../../external';
import {requestAndGetResponseInfo} from '../client';
import {startHttpDebugServer} from './debug-server';

export async function testCustomResponse() {
  const {origin, server} = await startHttpDebugServer();
  {
    const configWithoutData = {
      statusCode: 405,
      headers: {
        'trace-id': '123',
        'content-type': 'application/json',
      },
      delayMs: 3000,
      a: 'a',
    };
    const {responseInfo} = await requestAndGetResponseInfo({
      method: 'post',
      origin,
      pathname: HttpDebugServerPath.customResponse,
      data: configWithoutData,
    });
    assert.deepEqual(responseInfo.data, configWithoutData);
  }
  {
    const configWithData = {
      statusCode: 405,
      headers: {
        'trace-id': '123',
        'content-type': 'application/json',
      },
      delayMs: 3000,
      a: 'a',
      data: {
        a: 'a',
        b: 1,
        c: true,
      },
    };
    const {responseInfo} = await requestAndGetResponseInfo({
      method: 'post',
      origin,
      pathname: HttpDebugServerPath.customResponse,
      data: configWithData,
    });
    assert.deepEqual(responseInfo.data, configWithData.data);
  }

  server.close();
}
