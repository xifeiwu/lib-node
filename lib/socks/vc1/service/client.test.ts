import {sendHttpRequestByTcp, watchSocketState} from '../../../node';
import {EMethod} from './types';
import {connectToCustomSocksServer} from './client';

export async function basic() {
  const client = await connectToCustomSocksServer({
    socketConfig: {
      host: 'elif.site',
      port: 3307,
    },
    methodList: [
      // {method: EMethod.NoAuth},
      {method: EMethod.UserPass, info: {username: 'elif.site', password: 'socks5'}},
    ],
    targetServiceInfo: {
      address: 'www.google.com',
      port: 334,
    },
  });
  const {socket, targetServiceInfo, replyServiceInfo} = client;
  console.log(targetServiceInfo, replyServiceInfo);
  sendHttpRequestByTcp(
    {
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    },
    socket
  );
  socket.on('data', chunk => {
    console.log(chunk.toString());
  });
  watchSocketState(socket)
}

// curl 'https://www.google.com/' \
//   -H 'accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7' \
//   -H 'accept-language: en,zh-CN;q=0.9,zh;q=0.8' \
//   -H 'cache-control: max-age=0' \
//   -H 'upgrade-insecure-requests: 1' \
//   -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
