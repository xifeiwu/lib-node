/**
 * Client request connection, send a command(in any format, such as object, string)
 * Server wait socket connection, listen data from socket
 * Notice: Server should end data first
 */

import {NetConnectOpts, Socket} from 'net';
import {startSocketClient, startSocketServer} from './utils';
import {toBuffer} from '../transform';
import {CanConvertToBuffer} from '../types';

// @ts-ignore
export function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any>(
  payload: Payload,
  options: NetConnectOpts
): Promise<Socket>;
export function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any>(
  payload: Payload,
  port: number,
  host?: string,
  connectionListener?: () => void
): Promise<Socket>;
export function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any>(
  payload: Payload,
  path: string
): Promise<Socket>;

export async function oneChatFromSocketClient<Payload extends CanConvertToBuffer = any>(
  payload: Payload,
  ...args: [NetConnectOpts] | [number] | [number, string] | [string]
) {
  const client = await startSocketClient(...(args as [NetConnectOpts]));
  client.write(toBuffer(payload));
  const response = await new Promise<Buffer>((res, rej) => {
    client.once('data', chunk => {
      res(chunk);
    });
    client.once('close', hadError => {
      res(null);
    });
  });
  client.destroy();
  return response;
}

export async function startOneChatSocketServer(handlePayload: (data: Buffer) => Promise<CanConvertToBuffer>) {
  const serverInfo = await startSocketServer(socket => {
    socket.on('data', async chunk => {
      const response = await handlePayload(chunk);
      if (socket.writable) {
        socket.end(toBuffer(response));
      }
    });
  });
  return serverInfo;
}
