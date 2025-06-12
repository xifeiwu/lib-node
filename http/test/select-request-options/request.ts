import {sendHttpRequestByTcp} from '../../tcp/client';
import {
  getDataFromReadable,
  getDefaultTlsConfig,
  HttpRequestOptions,
  logColorful,
  requestAndGetResponseInfo,
  selectAndRequireFile,
  startHttpDebugServerOnTcp,
} from '../../../index';
import {getUrlPropsFromConfig, toNormalizedUrlProps} from '../../../external';
import path from 'path';

async function selectRequestOptions() {
  const selected = await selectAndRequireFile<{requestOptions: HttpRequestOptions}>([
    {targetDir: path.resolve(__dirname, 'request-options')},
  ]);
  return selected.requestOptions;
}

export async function requestThroughHttp() {
  const requestOptions = await selectRequestOptions();
  const {
    requestOptions: finalRequestOptions,
    responseInfo,
    request,
  } = await requestAndGetResponseInfo(requestOptions);
  logColorful({}, finalRequestOptions);
  logColorful({}, responseInfo);
}
export async function requestThroughTcp() {
  const requestOptions = await selectRequestOptions();
  const client = await sendHttpRequestByTcp(requestOptions);
  const responseData = await getDataFromReadable(client);
  logColorful({}, responseData);
}

export async function exploreDifferent() {
  const requestOptions = await selectRequestOptions();
  const {origin, server} = await startHttpDebugServerOnTcp({options: getDefaultTlsConfig()});
  const urlProps = toNormalizedUrlProps(requestOptions);
  const {restProps} = getUrlPropsFromConfig(requestOptions);
  const httpOptions: HttpRequestOptions = {
    ...urlProps,
    origin,
    ...restProps,
  };
  logColorful({}, httpOptions);

  const {requestOptions: finalRequestOptions, responseInfo} = await requestAndGetResponseInfo(httpOptions);
  logColorful({}, finalRequestOptions);
  logColorful({}, responseInfo);

  const client = await sendHttpRequestByTcp(httpOptions);
  const responseData = await getDataFromReadable(client);
  logColorful({}, responseData);

  server.close();
}
