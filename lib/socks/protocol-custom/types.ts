import {BinaryLike} from 'crypto';
import {SocksStatusOnClientSide, UserPassInfo} from '../service/types';

export interface SocksStatusOnCustomClientSide extends SocksStatusOnClientSide {
  iv: Buffer;
}

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: UserPassInfo;
  targetServiceInfo: SocksStatusOnClientSide['targetServiceInfo'];
}

export interface CustomProtocol {
  cipher?: {
    algorithm?: string;
    password?: string;
  };
}
