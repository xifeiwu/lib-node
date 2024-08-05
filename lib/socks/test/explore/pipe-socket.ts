import {Socket} from 'net';
import {
  HttpRequestOptions,
  getDataByTransform,
  httpOptionsToTcpConfig,
  httpRequestOptionsToCurlCommand,
  requestAndGetResponseInfo,
  sendHttpRequestByTcp,
  sendHttpRequestByTcpAndGetResponseData,
  startSocketClient,
  startSocketServer,
  tcpRequestPropsToBuffer,
  watchSocketState,
} from '../../../node';
import {connectToCustomSocksServer} from '../protocol-custom';
import {runSocksServerOnSocket} from '../server-on-socket';
import {getConnectStatusInJson} from '../service';
import {EMethod, ETargetServiceConnectState} from '../service/types';
import {
  replyTargetServiceInfo,
  sendTargetServiceInfo,
  waitReplyTargetServiceInfo,
  waitTargetServiceInfo,
} from '../service/protocol';
import {pipeline} from 'stream';
// import {connectToCustomSocksServer} from './client';

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
      // address: 'www.google.com',
      // port: 443,
      address: '127.0.0.1',
      port: 3180,
    },
  });
  const {socket, targetServiceInfo, replyServiceInfo} = client;
  console.log(targetServiceInfo, replyServiceInfo);
  watchSocketState(socket, {
    color: 'blue',
  });

  setTimeout(() => {
    sendHttpRequestByTcp(
      {
        pathname: '/api/debug/echo',
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
      console.log(`socket chunk.toString()`);
      console.log(chunk.toString());
    });
  }, 1000);
}

export async function reqeustGoogleByHttp() {
  const options: HttpRequestOptions = {
    // url: 'https://www.google.com',
    url: 'http://127.0.0.1:3180/api/debug/echo',
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'cache-control': 'max-age=0',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  };
  const response = await requestAndGetResponseInfo(options);
  console.log(response);
}

/**
 * Currently not support send request via tls
 */
export async function reqeustLocalBySocket() {
  const options: HttpRequestOptions = {
    /** Currently not support send request via tls */
    // url: 'https://www.google.com',
    url: 'http://127.0.0.1:3180/api/debug/echo',
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
      'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
      'cache-control': 'max-age=0',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  };
  const curlCmd = httpRequestOptionsToCurlCommand(options);
  console.log(curlCmd);
  const resBuffer = await sendHttpRequestByTcpAndGetResponseData(options);
  console.log(resBuffer.toString());
}

export async function startRelayServer() {
  const handleConnection = async (socket: Socket) => {
    const {address, port} = await waitTargetServiceInfo(socket);
    watchSocketState(socket, {color: 'yellow'});
    const client = await startSocketClient({host: address, port});
    watchSocketState(client, {color: 'red'});
    await replyTargetServiceInfo(socket, {reply: ETargetServiceConnectState.succeeded, address, port});

    // socket
    //   .pipe(
    //     getDataByTransform(data => {
    //       console.log(`from socket:`);
    //       console.log(data.toString());
    //     })
    //   )
    //   .pipe(client)
    //   .pipe(
    //     getDataByTransform(data => {
    //       console.log(`from client:`);
    //       console.log(data.toString());
    //     })
    //   )
    //   .pipe(socket);
    // pipeline(socket, client, err => {
    //   console.log(err);
    // });
    // pipeline(client, socket, err => {
    //   console.log(err);
    // });
    socket.pipe(client).pipe(socket);
  };
  return await startSocketServer(handleConnection);
}
export async function requestLocalByTwoSocket() {
  const {host, port} = await startRelayServer();
  const client = await startSocketClient({host, port});
  await sendTargetServiceInfo(client, {
    // addressType:
    address: '127.0.0.1',
    port: 3180,
  });
  await waitReplyTargetServiceInfo(client);
  watchSocketState(client, {color: 'black'});
  client.write(
    tcpRequestPropsToBuffer({
      url: '/api/debug/echo',
      headers: {
        accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      },
    })
  );
  client.resume();

  setTimeout(() => {
    client.write(
      tcpRequestPropsToBuffer({
        url: '/api/debug/echo',
        headers: {
          accept: 'application/json',
          'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
          'cache-control': 'max-age=0',
          'upgrade-insecure-requests': '1',
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        },
      })
    );
    // client.on('data', chunk => {
    //   console.log('on data:');
    //   console.log(chunk.toString());
    // });
  }, 100);

  // const options: HttpRequestOptions = {
  //   /** Currently not support send request via tls */
  //   // url: 'https://www.google.com',
  //   url: 'http://127.0.0.1:3180/api/debug/echo',
  //   headers: {
  //     accept:
  //       'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  //     'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
  //     'cache-control': 'max-age=0',
  //     'upgrade-insecure-requests': '1',
  //     'user-agent':
  //       'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  //   },
  // };
  // const {props, connectionOptions} = httpOptionsToTcpConfig(options);
  // const curlCmd = httpRequestOptionsToCurlCommand(options);
  // console.log(curlCmd);
  // const resBuffer = await sendHttpRequestByTcpAndGetResponseData(options);
  // console.log(resBuffer.toString());
}
