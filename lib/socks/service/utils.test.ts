// import {EMethod} from './types';
import {EMethod} from '../types/v5';
import {getMatchedProxyConfig, listenTimeOut} from './utils';

export function testGetMatchedProxyConfig() {
  const proxyAsSocketClientConfigList = [
    {
      methodList: [
        {method: EMethod.NoAuth},
        {method: EMethod.UserPass, info: {username: 'elif.site', password: 'socks5'}},
      ],
      socketConfig: {
        host: 'elif.site',
        port: 3307,
      },
      matches: [
        /google/,
        /medium.com/,
        /bonus.ly/,
        /youtube.com/,
        /github.com/,
        /formulae.brew.sh/,
        /chrome\.com/,
        'stackoverflow.com',
        'www.howtogeek.com',
        /imgur\.com/,
        /wikipedia/,
        /v2ex.com/,
      ],
    },
  ];

  const proxyAsClientConfig = (proxyAsSocketClientConfigList ?? []).find(
    getMatchedProxyConfig.bind(null, {
      command: 1,
      addressType: 3,
      address: 'v9b7qjpl6dw0.statuspage.io',
      port: 443,
    })
  );
  console.log(proxyAsClientConfig);
}

export async function testListenTimeOut() {
  try {
    const result = await new Promise((res, rej) => {
      const timeout = listenTimeOut(rej, {waitMs: 3000});
      setTimeout(() => {
        clearTimeout(timeout);
        res('success');
      }, 2000);
    });
    console.log(result);
  } catch (err) {
    console.log(err);
  }
}
