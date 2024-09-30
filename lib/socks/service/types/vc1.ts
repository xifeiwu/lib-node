import {BinaryLike} from 'crypto';
import {RequestTarget} from './base';
import {RequestTargetV5Response} from './v5';

/**
 * Client Side
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
export interface NegotiationResult extends NegotiationInfo {
  requestTargetResponse?: RequestTargetV5Response;
}
