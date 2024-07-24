import {HttpRequestOptions, requestAndGetResponseInfo, sendHttpRequestByTcp, watchSocketState} from '../../../node';
import {runSocksServerOnSocket} from '../server-on-socket';
import {getConnectStatusInJson} from '../service';
import {EMethod} from '../service/types';
import {connectToCustomSocksServer} from './client';

export async function basic() {
  const {
    socksService: {port},
  } = await runSocksServerOnSocket({
    cipher: {},
    methodList: [
      // {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'elif.site', password: 'socks5'}},
    ],
    serverConfig: {
      host: '0.0.0.0',
      port: 3307,
      // options: {
      //   allowHalfOpen: true,
      // },
    },
    httpServerConfig: {
      port: 3308,
    },
    onConnection(status) {
      console.log(getConnectStatusInJson(status));
    },
  });

  const client = await connectToCustomSocksServer({
    socketConfig: {
      host: '127.0.0.1',
      port: 3307,
    },
    methodList: [
      // {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'elif.site', password: 'socks5'}},
    ],
    targetServiceInfo: {
      address: 'www.google.com',
      port: 443,
    },
  });
  const {socket, targetServiceInfo, replyServiceInfo} = client;
  console.log(targetServiceInfo, replyServiceInfo);
  watchSocketState(socket, {
    color:'blue'
  });

  // setTimeout(() => {
  //   sendHttpRequestByTcp(
  //     {
  //       headers: {
  //         accept:
  //           'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  //         'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
  //         'cache-control': 'max-age=0',
  //         'upgrade-insecure-requests': '1',
  //         'user-agent':
  //           'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  //       },
  //     },
  //     socket
  //   );
  //   socket.on('data', chunk => {
  //     console.log(`socket chunk.toString()`);
  //     console.log(chunk.toString());
  //   });
  // }, 1000);
}


export async function reqeustGoogle() {
  const options: HttpRequestOptions = {
    url: 'https://www.google.com',
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'cache-control': 'max-age=0',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  }
  const response = await requestAndGetResponseInfo(options);
  console.log(response);
  
}