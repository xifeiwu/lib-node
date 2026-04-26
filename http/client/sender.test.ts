import assert from 'assert';
import {logColorful} from '../../log';
import {toReadable} from '../../stream';
import {startHttpDebugServer} from '../server';
import {mergeHttpRequestOptions, requestAndGetResponseInfo} from './sender';
import {CustomizeResponseOptions, HttpRequestOptions} from '../../types';
import {getAFreePort} from '../../net';
import {HttpDebugServerPath} from '../../external';
import {mergeHttpHeaders} from '../service';

export async function contentTypeAndStream() {
  const {origin, server} = await startHttpDebugServer();
  const payload = {
    a: 1,
    b: true,
  };
  const originRequestOptions: HttpRequestOptions = {
    method: 'post',
    origin,
    pathname: HttpDebugServerPath.echo,
    headers: {
      cookie: ['a=b', 'c=1'],
    },
  };
  {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      ...originRequestOptions,
      data: toReadable(payload),
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    // logColorful({}, requestOptions);
    logColorful({}, responseInfo);
    const {
      data: {data},
    } = responseInfo;
    assert.equal(data.type, 'Buffer');
  }
  /**
   * Take care about connection, keep-alive field on response headers part, like this:
   * connection: 'keep-alive',
   * 'keep-alive': 'timeout=5'
   * If the debug time is longer than 5 seconds, the connection will be closed.
   */
  {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      ...originRequestOptions,
      headers: {
        'content-type': 'application/json',
      },
      data: toReadable(payload),
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    // logColorful({}, requestOptions);
    logColorful({}, responseInfo);
    const {
      data: {data},
    } = responseInfo;
    assert.deepEqual(data, payload);
  }
  server.close();
}

export async function testUnreachable() {
  const origin = 'http://127.0.0.1:' + (await getAFreePort());
  const config: CustomizeResponseOptions = {
    delayMs: 1000 * 1000,
  };
  try {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      origin,
      method: 'post',
      pathname: HttpDebugServerPath.customResponse,
      headers: {
        'content-type': 'application/json',
      },
      data: config,
      // This will set the timeout before the socket is connected.
      timeout: 12000,
    });
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
  } catch (err) {
    console.log(err);
    assert.equal(err.code, 'ECONNREFUSED');
  } finally {
  }
}

/**
 * client can wait for 1000s before close
 */
export async function testTimeout() {
  const {origin, server} = await startHttpDebugServer();
  const config: CustomizeResponseOptions = {
    delayMs: 1000 * 1000,
  };
  try {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      origin,
      method: 'post',
      pathname: HttpDebugServerPath.customResponse,
      headers: {
        'content-type': 'application/json',
      },
      data: config,
      // This will set the timeout before the socket is connected.
      timeout: 12000,
    });
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
  } catch (err) {
    console.log(err);
  } finally {
    server.close();
  }
}

export async function testMergeHttpHeadersIgnoreNullable() {
  const headers = mergeHttpHeaders(
    {
      cookie: 'a=1',
      accept: 'application/json',
      authorization: 'Bearer token',
    },
    {
      cookie: undefined,
      accept: null as any,
      host: 'example.com',
    },
    {ignoreNullable: true}
  );
  assert.deepEqual(headers, {
    cookie: 'a=1',
    accept: 'application/json',
    authorization: 'Bearer token',
    host: 'example.com',
  });
}

export async function testMergeHttpRequestOptionsIgnoreNullable() {
  const options = mergeHttpRequestOptions(
    {
      origin: 'http://first.example.com',
      method: 'GET',
      pathname: '/users',
      headers: {
        accept: 'application/json',
        authorization: 'Bearer token',
      },
    },
    {
      origin: undefined,
      method: null as any,
      pathname: '/accounts',
      headers: {
        accept: undefined,
        host: 'second.example.com',
      },
    },
    {ignoreNullable: true}
  );
  assert.deepEqual(options, {
    origin: 'http://first.example.com',
    method: 'GET',
    pathname: '/accounts',
    headers: {
      accept: 'application/json',
      authorization: 'Bearer token',
      host: 'second.example.com',
    },
  });
}

export async function testEmptyArray() {
  {
    const {origin, server} = await startHttpDebugServer();
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      method: 'delete',
      origin,
      pathname: HttpDebugServerPath.echo,
      // method: 'delete',
      // origin: 'http://127.0.0.1:7778',
      // pathname: '/v1.0/users',
      // headers: {
      //   cookie: '_turtle_pulse_session_id=ae18b64418290abf59866b172945e2c4',
      // },
      // data: toReadable({
      //   a: 1,
      //   b: true,
      // }),
      // data: [],
      data: [
        {
          customer: {
            id: 1960183749,
          },
          users: [
            {
              email: '2020@88.com',
              firstName: 'xf',
              lastName: 'wu',
              roleId: 1,
              canCreateActivation: true,
              canEditPrecisionPolicy: false,
              mdsEnabled: true,
              ciEnabled: false,
              ciCreateSegmentPermission: false,
              ciExportPermission: true,
              ciShareSegmentCreatedByMePermission: false,
              ciSegmentAdminPermission: false,
              hidden: true,
            },
          ],
        },
      ],
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
    server.close();
  }
}
