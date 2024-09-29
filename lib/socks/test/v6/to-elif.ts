import {connectToSocksServer} from '../../client';
import {getInfoFromStateTracer} from '../../service';
import {requestAndGetResponseInfo, HttpRequestOptions, tcpRequestPropsToBuffer} from '../../service/external';
import {eorBuffer, getDcipher} from '../../v6/service';

export async function httpRequestToGoogle() {
  const options: HttpRequestOptions = {
    /** Currently not support send request via tls */
    url: 'https://www.google.com',
    // url: 'http://127.0.0.1:3180/api/debug/echo',
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
  // const tcpConfig = httpOptionsToTcpConfig(options);
  // const buffer = tcpRequestPropsToBuffer(tcpConfig.props);
  // const client = await getSocket(tcpConfig.connectionOptions);
  // client.write(buffer);
  // client.on('data', chunk => {
  //   console.log(chunk.toString());
  // });
  // const curlCmd = httpRequestOptionsToCurlCommand(options);
  // console.log(curlCmd);
  // const resBuffer = await sendHttpRequestByTcpAndGetResponseData(options);
  // console.log(resBuffer.toString());
  const response = await requestAndGetResponseInfo(options);
  console.log(response);
}

/**
 * NOTICE:
 * Can not request https server.
 */
export async function requestToElif() {
  const auth = {username: 'elif.site', password: 'socks5'};
  const httpOptions: HttpRequestOptions = {
    origin: 'http://elif.site',
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
  };
  const response = await requestAndGetResponseInfo(httpOptions);
  console.log(`response`);
  console.log(response);
  try {
    const {origin, pathname, headers} = httpOptions;
    const status = await connectToSocksServer({
      socksVersion: 'v6',
      auth,
      targetSocksServer: {
        // host: 'elif.site',
        host: '124.156.155.64',
        port: 3307,
      },
      // clientRequestInfo: 'https://www.google.com',
      requestTarget: httpOptions.origin,
    });
    const {socket, stateTracer} = status;
    const iv = getInfoFromStateTracer(stateTracer, 'iv');
    const deciper = getDcipher(iv);
    socket.write(
      eorBuffer(
        tcpRequestPropsToBuffer({
          url: pathname,
          headers,
        }),
        iv
      )
    );
    socket.pipe(deciper).on('data', chunk => {
      console.log(`chunk.byteLength:`);
      console.log(chunk.byteLength);
      console.log(chunk.toString());
    });
    // socket.on('data', chunk => {
    //   console.log(`chunk.byteLength:`);
    //   console.log(chunk.byteLength);
    //   console.log(chunk.toString());
    // });
  } catch (err) {
    console.log(err);
  }
}
