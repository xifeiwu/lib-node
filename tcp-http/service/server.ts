import http, {IncomingHttpHeaders} from 'http';
import {Socket} from 'net';

export function responseHttpConnection(
  socket: Socket,
  options?: {code?: number; message?: string; headers?: IncomingHttpHeaders}
) {
  let {code = 200, message, headers = {}} = options ?? {};
  //
  // The socket is writable unless the user destroyed or ended it before calling
  // `server.handleUpgrade()` or in the `verifyClient` function, which is a user
  // error. Handling this does not make much sense as the worst that can happen
  // is that some of the data written by the user might be discarded due to the
  // call to `socket.end()` below, which triggers an `'error'` event that in
  // turn causes the socket to be destroyed.
  //
  message = message || http.STATUS_CODES[code];
  const mergedHeaders = {
    Connection: 'close',
    'Content-Type': 'text/html',
    'Content-Length': Buffer.byteLength(message),
    ...headers,
  };

  socket.once('finish', socket.destroy);

  socket.end(
    `HTTP/1.1 ${code} ${http.STATUS_CODES[code]}\r\n` +
      Object.keys(mergedHeaders)
        .map(h => `${h}: ${mergedHeaders[h]}`)
        .join('\r\n') +
      '\r\n\r\n' +
      message
  );
}
