import {sendHttpRequestByTcp} from '../../tcp/client';
import {goOnOrNot, HttpRequestOptions, logColorful, requestAndGetResponseInfo} from '../../../index';

export async function requestThroughHttpAndPrintResponse(requestOptions: HttpRequestOptions) {
  const {
    requestOptions: finalRequestOptions,
    responseInfo,
    request,
  } = await requestAndGetResponseInfo(requestOptions);
  logColorful({}, finalRequestOptions);
  const {data, ...rest} = responseInfo;
  logColorful({}, rest);
  if (
    await goOnOrNot({
      tips: [`print resoibse data in string format?`],
      defaultValue: true,
    })
  ) {
    logColorful({}, data);
  }
}

/**
 * As it's a common logic for debug tcp connection, extract it as a common logic here.
 */
export async function requestThroughTcpAndPrintResponse(requestOptions: HttpRequestOptions) {
  const client = await sendHttpRequestByTcp(requestOptions);
  const bufList: Buffer[] = [];
  client.on('data', async chunk => {
    logColorful({color: 'red'}, `size: ${chunk.byteLength}`);
    if (
      await goOnOrNot({
        tips: [`print chunk data in string format?`],
        defaultValue: false,
      })
    ) {
      logColorful({}, chunk);
    }
    bufList.push(chunk);
  });
  client.on('end', async chunk => {
    const allData = Buffer.concat(bufList);
    logColorful({color: 'red'}, `total size: ${allData.byteLength}`);
    if (
      await goOnOrNot({
        tips: [`print response data in string format?`],
        defaultValue: true,
      })
    ) {
      logColorful({}, allData);
    }
  });
}
