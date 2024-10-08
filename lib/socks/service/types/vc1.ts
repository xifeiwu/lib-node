import {BinaryLike} from 'crypto';
import {RequestTargetV5, RequestTargetV5Response} from './v5';
import {RequestTarget} from './base';

/**
 * Client Side
 */
export interface NegotiationInfoClient {
  iv: BinaryLike;
  auth: {
    username: string;
    password: string;
  };
  requestTarget: RequestTarget;
}
export interface NegotiationInfoServer extends Omit<NegotiationInfoClient, 'requestTarget'> {
  requestTarget: RequestTargetV5;
}

/** For Server Side */
export interface ServerConfig extends Pick<NegotiationInfoClient, 'auth'> {}
export interface NegotiationResult extends Omit<NegotiationInfoClient, 'requestTarget'> {
  requestTarget: RequestTargetV5;
  requestTargetResponse?: RequestTargetV5Response;
}
