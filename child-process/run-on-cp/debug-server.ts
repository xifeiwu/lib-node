import {
  startHttpServer,
  responseRequestInfo,
  InfoToCp,
  getAFreePort,
  toBuffer,
  toHtml,
  toUl,
  toUrlProps,
} from '../../index';
import {handleCpCustomization, out, runAllCpCustomization} from './service';
import {CP} from '../../types';

const allPathname = {
  apiList: '/api',
  exitProcess: '/api/exit',
  getEnv: '/api/env',
};
const apiListHtml = toHtml(
  toUl(
    Object.entries(allPathname).map(([key, href]) => {
      return {
        href,
        content: key,
      };
    })
  )
);

export async function start() {
  let ipcMessage: InfoToCp<CP.DebugServerConfig> = {};
  if (process.send) {
    ipcMessage = await new Promise<InfoToCp<CP.DebugServerConfig>>(res => {
      process.once('message', (chunk: InfoToCp<CP.DebugServerConfig>) => {
        res(chunk);
      });
      /** Wait message for one second at most */
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config = {}} = ipcMessage;
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
              const {pathname} = toUrlProps(url);
              if (pathname === '/api/exit') {
                response.statusCode = 302;
                response.setHeader('Location', allPathname.apiList);
                response.setHeader('content-type', 'text/plain; charset=utf-8');
                response.end(
                  toBuffer(`Redirecting to <a href="${allPathname.apiList}">${allPathname.apiList}</a>.`)
                );
                setTimeout(() => {
                  process.exit(0);
                }, 2000);
              } else if (pathname === allPathname.getEnv) {
                response.setHeader('content-type', 'application/json; charset=utf-8');
                const env = process.env;
                console.log(JSON.stringify(env));
                const buf = toBuffer(JSON.stringify(env));
                response.end(buf);
              } else if (pathname === allPathname.apiList) {
                response.setHeader('content-type', 'text/html; charset=utf-8');
                response.end(toBuffer(apiListHtml));
              } else {
                responseRequestInfo(request, response);
              }
            },
          },
          {port: config[key]}
        );
        const info: CP.DebugServerResponse = {origin, host, port};
        out(info);
      } catch (err) {
        out(err.message);
      }
    } else {
      await handleCpCustomization(config, key);
    }
  }
}

start();
