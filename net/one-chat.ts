/**
 * Client request connection, send a command(in any format, such as object, string) and wait for response data.
 * Server wait socket connection, listen data from socket, and end connection with response.
 * Notice: Server should end data first
 */
import {NetConnectOpts} from 'net';
import {startSocketClient, startSocketServer} from './service';
import {fromBuffer, convertToBuffer} from '../transform';
import {CanConvertToBuffer, OneChatHandler, TcpServerConfig} from '../types';

export async function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any, Response = any>(
  payload: Payload,
  connectOpts: NetConnectOpts
) {
  const client = await startSocketClient(connectOpts);
  client.write(convertToBuffer(payload));
  const response = await new Promise<Response>((res, rej) => {
    const chunkList: Buffer[] = [];
    const concatAndConvert = () => fromBuffer(Buffer.concat(chunkList), 'json') as Response;
    client.on('data', chunk => {
      chunkList.push(chunk);
    });
    client.on('end', chunk => {
      res(concatAndConvert());
    });
    client.on('close', hadError => {
      res(concatAndConvert());
    });
    client.on('error', err => {
      rej(err);
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
        socket.end(convertToBuffer(response));
      }
    });
  }, config);
  return serverInfo;
}
