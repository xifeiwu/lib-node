import {BinaryLike} from 'crypto';
import {RequestTargetV5, RequestTargetResponseV5} from './v5';
import {RequestTarget} from './base';

/**
 * Client Side
 */
export interface NegotiationInfoClient {
  auth: {
    username: string;
    password: string;
  };
  requestTarget: RequestTarget;
}
export interface NegotiationInfoServer extends Omit<NegotiationInfoClient, 'requestTarget'> {
  iv: BinaryLike;
  requestTarget: RequestTargetV5;
}

/** For Server Side */
export interface ServerConfig extends Pick<NegotiationInfoClient, 'auth'> {}
export interface NegotiationResult extends NegotiationInfoServer {
  requestTargetResponse?: RequestTargetResponseV5;
}
