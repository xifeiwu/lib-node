import {HttpDebugServerPath} from '../../external';
import {logColorful} from '../../log';
import {HttpRequestOptions} from '../../types';
import {requestAndGetResponseInfo} from '../client';
import {startHttpDebugServer} from '../server';
import {requestAndGetResponseOnTcp, startHttpDebugServerOnTcp} from '../tcp';

function getRequestOptions(options: Required<Pick<HttpRequestOptions, 'origin'>>): HttpRequestOptions {
  const defaultOptions: HttpRequestOptions = {
    method: 'post',
    pathname: HttpDebugServerPath.echo,
    headers: {
      TRACE_id: '123',
    },
    data: {a: 1, b: 'c', d: true},
  };
  return {
    ...defaultOptions,
    ...options,
  };
}

export async function name() {
  const {origin: origin1, server: server1} = await startHttpDebugServer();
  const {origin: origin2, server: server2} = await startHttpDebugServerOnTcp();
  {
    const requestOptionsToHttpServer = getRequestOptions({origin: origin1});
    const {responseInfo} = await requestAndGetResponseInfo(requestOptionsToHttpServer);
    const response = await requestAndGetResponseOnTcp(requestOptionsToHttpServer);
    logColorful({color: 'green'}, responseInfo);
    logColorful({color: 'green'}, response);
  }
  {
    const requestOptionsToTcpServer = getRequestOptions({origin: origin1});
    const {responseInfo} = await requestAndGetResponseInfo(requestOptionsToTcpServer);
    const response = await requestAndGetResponseOnTcp(requestOptionsToTcpServer);
    logColorful({color: 'green'}, responseInfo);
    logColorful({color: 'green'}, response);
  }
  server1.close();
  server2.close();
}
