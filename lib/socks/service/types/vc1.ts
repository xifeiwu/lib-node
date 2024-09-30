import {BinaryLike} from 'crypto';
import {RequestTarget} from './base';

/**
 * Negotiation info send from client to server
 */
export interface NegotiationInfo {
  iv: BinaryLike;
  auth: {
    username: string;
    password: string;
  };
  requestTarget: RequestTarget;
}
/** For Server Side */
export interface ServerConfig extends Pick<NegotiationInfo, 'auth'> {}
