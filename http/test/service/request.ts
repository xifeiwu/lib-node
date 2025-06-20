import {sendHttpRequestByTcp} from '../../tcp';
import {
  getSocketInfo,
  goOnOrNot,
  HttpRequestOptions,
  logColorful,
  requestAndGetResponseInfo,
} from '../../../index';
import {intToWord} from '../../../external';

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
  let totalSize = 0;
  client.on('data', async chunk => {
    totalSize += chunk.byteLength;
    logColorful({color: 'red'}, `size: ${chunk.byteLength}/${totalSize}`);
    /** print header part */
    if (bufList.length === 0) {
      logColorful({}, chunk);
    }
    bufList.push(chunk);
    // client.pause();
    // if (
    //   await goOnOrNot({
    //     tips: [`print chunk data in string format?`],
    //     defaultValue: false,
    //   })
    // ) {
    //   logColorful({}, chunk);
    // }
    // client.resume();
  });
  client.on('end', async chunk => {
    const allData = Buffer.concat(bufList);
    logColorful({color: 'red'}, `total size: ${intToWord(allData.byteLength)}/${totalSize}`);
    if (
      await goOnOrNot({
        tips: [`print response data in string format?`],
        defaultValue: true,
      })
    ) {
      logColorful({}, allData);
    }
    logColorful({color: 'red'}, `total size: ${intToWord(allData.byteLength)}`);
    logColorful({color: 'red'}, getSocketInfo(client));
  });
}
