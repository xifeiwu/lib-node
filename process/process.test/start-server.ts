/** Start a server as child process */
import http from 'http';
import {getAFreePort} from '../net';

export enum STATE {
  CLOSE = 'close',
}
export const resData = 'hello';

async function start() {
  const port = await getAFreePort();
  await new Promise((res, rej) => {
    const server = http
      .createServer((_req, res) => {
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.write(resData);
        res.end();
      })
      .listen(port);
    server.on('listening', res);
  });
  // if (process.send) {
  process.send({
    port,
  });
  // }
  process.on('message', message => {
    console.log(`${port}: ${message}`);
  });
}

start();
