import {BinaryLike} from 'crypto';
import {SocksClientInfo, UserPassInfo} from '../service/types';

export interface SocksStatusOnCustomClientSide extends SocksClientInfo {
  iv: Buffer;
}

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: UserPassInfo;
  targetServiceInfo: SocksClientInfo['targetServiceInfo'];
}

// export interface CustomProtocol {
//   cipher?: {
//     algorithm?: string;
//     password?: string;
//   };
// }
