import {listAUsingUl, toNormalizedUrlProps} from '../../../external';
import {handleCpCustomization, outOnAllChannels} from './base';
import {getAFreePort} from '../../../net';
import {responseHttpRequestInfo, startHttpServer} from '../../../http';
import {convertToBuffer} from '../../../transform';
import {CP} from '../../../types';
import {waitIpcMessageOnce} from '../../service';

const pathnameDesc: Record<string, {pathname: string; desc?: string}> = {
  apiList: {pathname: '/api/list'},
  exitProcess: {pathname: '/api/exit'},
  getEnv: {pathname: '/api/env'},
};

const apiListHtml = listAUsingUl({
  infoList: Object.entries(pathnameDesc).map(([key, value]) => {
    const {pathname, desc} = value;
    return {
      href: pathname,
      text: pathname + desc ? ` [${desc}]` : '',
    };
  }),
});

/**
 * This is a http server target to run on child process to explore feature of child_process
 */
export async function startCustomizedServer() {
  let ipcMessage: CP.DebugServerConfig = await waitIpcMessageOnce<CP.DebugServerConfig>({maxWaitInSec: 9});
  // if (process.send) {
  //   ipcMessage = await new Promise<CP.DebugServerConfig>(res => {
  //     process.once('message', (chunk: CP.DebugServerConfig) => {
  //       res(chunk);
  //     });
  //     /** Wait message for one second at most */
  //     setTimeout(() => {
  //       res({});
  //     }, 8000);
  //   });
  // }
  const config = ipcMessage;
  /** Make sure port property exist */
  if (config['port'] === undefined) {
    config['port'] = await getAFreePort();
  }
  for (const key of Object.keys(config)) {
    if (key === 'port') {
      try {
        const {origin, host, port} = await startHttpServer(
          {
            request(request, response) {
              const {url} = request;
              const {pathname} = toNormalizedUrlProps(url);
              if (pathname === '/api/exit') {
                response.statusCode = 302;
                response.setHeader('Location', pathnameDesc.apiList.pathname);
                response.setHeader('content-type', 'text/plain; charset=utf-8');
                response.end(
                  convertToBuffer(
                    `Redirecting to <a href="${pathnameDesc.apiList}">${pathnameDesc.apiList}</a>.`
                  )
                );
                setTimeout(() => {
                  process.exit(0);
                }, 2000);
              } else if (pathname === pathnameDesc.getEnv.pathname) {
                response.setHeader('content-type', 'application/json; charset=utf-8');
                const env = process.env;
                console.log(JSON.stringify(env));
                const buf = convertToBuffer(JSON.stringify(env));
                response.end(buf);
              } else if (pathname === pathnameDesc.apiList.pathname) {
                response.setHeader('content-type', 'text/html; charset=utf-8');
                response.end(convertToBuffer(apiListHtml));
              } else {
                responseHttpRequestInfo(request, response);
              }
            },
          },
          {port: config[key]}
        );
        const info: CP.DebugServerResponse = {origin, host, port};
        outOnAllChannels(info);
      } catch (err) {
        outOnAllChannels(err.message);
      }
    } else {
      await handleCpCustomization(config, key);
    }
  }
}
