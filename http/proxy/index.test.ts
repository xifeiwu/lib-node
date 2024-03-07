import https from 'https';
import {startProxyServer} from '.';
import {getResponseInfo} from '../common';
import {HttpProxyConfig, ProxyRequestInfo} from './types';

// https://pulse.conviva.com/
export async function proxyToBaidu() {
  const config: HttpProxyConfig = {
    targetHref: 'https://www.baidu.com',
    // targetHref: 'https://pulse.conviva.com',
    handleProxyReqInfo(options) {
      console.log(options);
    },
  };
  const {origin, server} = await startProxyServer(config);
  console.log(origin);
}

export async function requestTarget() {
  const config: ProxyRequestInfo = {
    href: 'https://www.baidu.com//',
    protocol: 'https:',
    requestOptions: {
      method: 'GET',
      headers: {
        host: 'www.baidu.com',
        connection: 'keep-alive',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-encoding': 'gzip, deflate',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
      },
    },
  };
  const {href, requestOptions} = config;
  const client = https.request(href, requestOptions);
  client.end();
  client.on('response', async res => {
    const info = await getResponseInfo(res);
    console.log(info);
  });
  client.on('error', err => {
    console.log(err);
  });
}
