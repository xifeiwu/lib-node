import {BinaryLike} from 'crypto';
import {ClientRequestInfo} from './v5';
import { SocksClientV6NegotiationInfo } from './cross';

// export interface SocksStatusOnCustomClientSide extends SocksClientInfo {
//   iv: Buffer;
// }

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: SocksClientV6NegotiationInfo['auth'];
  clientRequestInfo: ClientRequestInfo;
}
