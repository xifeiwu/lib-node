import {BinaryLike} from 'crypto';
import {SocksClientStatus, UserPassInfo} from '../service/types';

export interface SocksStatusOnCustomClientSide extends SocksClientStatus {
  iv: Buffer;
}

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: UserPassInfo;
  targetServiceInfo: SocksClientStatus['targetServiceInfo'];
}

// export interface CustomProtocol {
//   cipher?: {
//     algorithm?: string;
//     password?: string;
//   };
// }
