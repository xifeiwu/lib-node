import http from 'http';
import https from 'https';
import {getStreamData} from '../../stream';
// import {getAFreePort} from '../../net/http';
import {proxyRequest} from './handler';
import {getRequestHeaderInfo} from '../common';
import {requestAndGetResponseInfo} from '../client';
import { getAFreePort } from '../../net';

/**
 * For handler2, req.readable is false
 */
export async function twoWayOfProxyPayload() {
  const handler1: http.RequestListener = (req, res) => {
    console.log(`req.readable`);
    console.log(req.readable);
    proxyRequest(req, res, {
      targetHref: 'http://elif.site',
      handleInfoOfRes2Origin(info) {
        const {headers} = info;
        headers.handler = 'handler1';
        return info;
      },
    });
  };
  const handler2: http.RequestListener = async (req, res) => {
    const data = await getStreamData(req);
    console.log(`req.readable`);
    console.log(req.readable);
    proxyRequest(req, res, {
      originData: data,
      targetHref: 'http://elif.site',
      handleInfoOfRes2Origin(info) {
        const {headers} = info;
        headers.handler = 'handler2';
        return info;
      },
    });
  };
  const {origin} = await new Promise<{origin: string}>(async (res, rej) => {
    const host = '0.0.0.0';
    const port = await getAFreePort();
    const origin = `http://${host}:${port}`;
    const server = http.createServer();
    server.listen(port, host);
    server.on('listening', () => {
      res({origin});
    });
    server.on('request', (req, res) => {
      const {headers} = getRequestHeaderInfo(req);
      const {handler = '2'} = headers;
      if (handler === '2') {
        return handler2(req, res);
      }
      handler1(req, res);
    });
    server.on('error', err => {
      rej(err);
    });
  });
  console.log(`listening on ${origin}`);

  const resInfo1 = await requestAndGetResponseInfo({
    url: `${origin}/api/debug/echo`,
    headers: {
      handler: '1',
    },
  });
  console.log(resInfo1);
  const resInfo2 = await requestAndGetResponseInfo({
    url: `${origin}/api/debug/echo`,
    headers: {
      handler: '2',
    },
  });
  console.log(resInfo2);
}

export async function tryRequest() {
  const request = https.request(
    'https://pulse-penguin.qe2.conviva.com/ifserver/v1.0/customerCheck?mode=app',
    {
      method: 'GET',
      agent: new https.Agent({
        rejectUnauthorized: false,
      }),
      headers: {
        cookie:
          '_horizontalqe_pulse_session_id=643b0fc31291d10b58b57ac5bf6f8c26;_turtle_pulse_session_id=3b35c0b3c559c8ca8b2676d1394ae202;_penguin_pulse_session_id=184669eae4fa7f1e6f2f689172e3b275;_husky_pulse_session_id=81a3280cb029474e27850351a5f22684;_elephant_pulse_session_id=ee5b098cefae7118fcd7182eb7bb08ab;_webappgcp_pulse_session_id=819a0d5536f169a38f5aad1aea38b5e6;_pulse_session_id=26fe6cb399e1b3967d84c8fff5ff2a90',
        'accept-language': 'en,zh-CN;q=0.9,zh;q=0.8',
        'accept-encoding': 'gzip, deflate, br, zstd',
        referer: 'https://pulse-penguin.qe2.conviva.com',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'sec-ch-ua-platform': '"macOS"',
        'x-cid': 'MTk2MDE4Mzc0OQ==',
        'trace-id': '00000000000000000000000000000000',
        accept: 'application/json, text/plain, */*',
        'x-context': 'APP',
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        'sec-ch-ua-mobile': '?0',
        'x-pulse-page-url': 'http://127.0.0.1:3000/app-insights/dashboard/app-experience',
        traceparent: '00-00000000000000000000000000000000-0000000000000000-00',
        'sec-ch-ua': '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        'x-trace-id': '0352db84033548f4805ae42fdda9dd07',
        connection: 'close',
        // host: '127.0.0.1:7777',
        origin: 'https://pulse-penguin.qe2.conviva.com',
      },
    }
  );
  request.end();
  request.on('response', async res => {
    const data = await getStreamData(res);
    const dataStr = data.toString();
    console.log(dataStr);
  });
}
