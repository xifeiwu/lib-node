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
import {requestThroughHttpAndPrintResponse, requestThroughTcpAndPrintResponse} from '../service';

async function selectRequestOptions() {
  const selected = await selectAndRequireFile<{httpRequestOptions: HttpRequestOptions}>([
    {targetDir: path.resolve(__dirname, 'request-options')},
  ]);
  return selected.httpRequestOptions;
}

export async function requestThroughHttp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughHttpAndPrintResponse(requestOptions);
}

export async function requestThroughTcp() {
  const requestOptions = await selectRequestOptions();
  await requestThroughTcpAndPrintResponse(requestOptions);
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
