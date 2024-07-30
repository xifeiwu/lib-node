import {BinaryLike} from 'crypto';
import {TargetServiceInfo} from './v5';
import { SocksClientExchangeInfoConfigV6 } from './cross';

// export interface SocksStatusOnCustomClientSide extends SocksClientInfo {
//   iv: Buffer;
// }

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: SocksClientExchangeInfoConfigV6['auth'];
  targetServiceInfo: TargetServiceInfo;
}
