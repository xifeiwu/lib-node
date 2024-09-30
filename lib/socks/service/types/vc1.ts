import {BinaryLike} from 'crypto';
import {RequestTarget} from './base';

export interface NegotiationInfo {
  iv: BinaryLike;
  auth: {
    username: string;
    password: string;
  };
  requestTarget: RequestTarget;
}
