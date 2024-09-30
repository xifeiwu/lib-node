import {BinaryLike} from 'crypto';
import {RequestTargetV5, RequestTargetV5Response} from './v5';
import {RequestTarget} from './base';

/**
 * Client Side
 */
export interface ClientNegotiationInfo {
  iv: BinaryLike;
  auth: {
    username: string;
    password: string;
  };
  requestTarget: RequestTarget;
}

/** For Server Side */
export interface ServerConfig extends Pick<ClientNegotiationInfo, 'auth'> {}
export interface NegotiationResult extends Omit<ClientNegotiationInfo, 'requestTarget'> {
  requestTarget: RequestTargetV5;
  requestTargetResponse?: RequestTargetV5Response;
}
