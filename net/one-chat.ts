/**
 * Client request connection, send a command(in any format, such as object, string)
 * Server wait socket connection, listen data from socket, and end connection with response.
 * Notice: Server should end data first
 */
import {NetConnectOpts} from 'net';
import {startSocketClient, startSocketServer} from './service';
import {fromBuffer, toBuffer} from '../transform';
import {CanConvertToBuffer, OneChatHandler, TcpServerConfig} from '../types';

export async function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any, Response = any>(
  payload: Payload,
  connectOpts: NetConnectOpts
) {
  const client = await startSocketClient(connectOpts);
  client.write(toBuffer(payload));
  const response = await new Promise<Response>((res, rej) => {
    client.once('data', chunk => {
      res(fromBuffer(chunk, 'json') as Response);
    });
    client.once('close', hadError => {
      res(null);
    });
  });
  client.destroy();
  return response;
}

export async function startOneChatSocketServer(handlePayload: OneChatHandler, config?: TcpServerConfig) {
  const serverInfo = await startSocketServer(socket => {
    socket.on('data', async chunk => {
      const response = await handlePayload(chunk);
      if (socket.writable) {
        socket.end(toBuffer(response));
      }
    });
  }, config);
  return serverInfo;
}
