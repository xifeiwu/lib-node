import {sendHttpRequestByTcp} from './client';
import {
  DebugServerPathname,
  getDataFromReadable,
  handleSocketEvents,
  HttpRequestOptions,
  logColorful,
  startHttpDebugServer,
  startSocketClient,
} from '../../index';

export async function testSendHttpRequestByTcp() {
  const {origin} = await startHttpDebugServer();
  const requestOptions: HttpRequestOptions = {
    origin,
    pathname: DebugServerPathname.customResponse,
  };
  const client = await sendHttpRequestByTcp(requestOptions);
  const responseData = await getDataFromReadable(client);
  logColorful({}, responseData);
}
