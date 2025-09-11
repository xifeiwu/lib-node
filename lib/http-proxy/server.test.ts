import {PATHNAME_PROXY_STATUS, startProxyServer} from '.';
import {HttpProxyConfig} from './types';
import {requestAndGetResponseInfo, waitFor} from './external';

// https://pulse.conviva.com/
export async function proxyToBaidu() {
  const config: HttpProxyConfig = {
    globalRequestOptions: {
      origin: 'https://www.baidu.com',
    },
    handleProxyRequestOptions(reqInfo) {
      console.log(`reqInfo`);
      console.log(reqInfo);
    },
    handleResponseInfoToOrigin(resInfo) {
      console.log(`resInfo`);
      console.log(resInfo);
    },
  };
  const {origin, server} = await startProxyServer(config);
  console.log(origin);
  await waitFor(10000);
  const {
    responseInfo: {data: proxyStatusList},
  } = await requestAndGetResponseInfo({
    url: origin + PATHNAME_PROXY_STATUS,
  });
  console.log(proxyStatusList);
}

// export async function requestTarget() {
//   const config: ProxyRequestInfo = {
//     href: 'https://www.baidu.com//',
//     protocol: 'https:',
//     requestOptions: {
//       method: 'GET',
//       headers: {
//         host: 'www.baidu.com',
//         connection: 'keep-alive',
//         'upgrade-insecure-requests': '1',
//         'user-agent':
//           'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
//         accept:
//           'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
//         'accept-encoding': 'gzip, deflate',
//         'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
//       },
//     },
//   };
//   const {href, requestOptions} = config;
//   const client = https.request(href, requestOptions);
//   client.end();
//   client.on('response', async res => {
//     const info = await getResponseInfo(res);
//     console.log(info);
//   });
//   client.on('error', err => {
//     console.log(err);
//   });
// }

/** Web browser can not connect to this server by https protocol, and will show error message: ERR_SSL_PROTOCOL_ERROR */
export async function test443Port() {
  await startProxyServer(
    {
      globalRequestOptions: {
        origin: 'http://elif.site',
      },
    },
    {port: 443}
  );
}
