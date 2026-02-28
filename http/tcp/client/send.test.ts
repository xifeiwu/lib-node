import {sendHttpRequestByTcp} from './send';
import {getDataFromReadable, HttpRequestOptions, logColorful, startHttpDebugServer} from '../../../index';
import {HttpDebugServerPath} from '../../../external';

export async function testSendHttpRequestByTcp() {
  const {origin} = await startHttpDebugServer();
  const requestOptions: HttpRequestOptions = {
    method: 'post',
    origin,
    pathname: HttpDebugServerPath.echo,
    data: {
      a: 1,
      b: 'c',
      d: true,
    },
  };
  const client = await sendHttpRequestByTcp(requestOptions);
  const responseData = await getDataFromReadable(client);
  logColorful({}, responseData);
}
