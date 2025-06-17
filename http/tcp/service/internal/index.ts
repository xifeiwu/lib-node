/**
 * For logic in dir internal, it's only used internally, will not export to outside
 */
import {Socket} from 'net';
import {HttpIncomingMessage} from './http-incoming-message';

export async function getHttpIncomingMessage(socket: Socket, options?: {}) {
  const incomingMessage = new HttpIncomingMessage(socket);
  await incomingMessage.parse();
  return incomingMessage;
}
