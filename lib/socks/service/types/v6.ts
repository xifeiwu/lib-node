import {BinaryLike} from 'crypto';
import {ClientRequestInfo} from './v5';
import {SocksClientNegotiationInfoV6} from './cross';

export interface ConnectionInfo {
  iv: BinaryLike;
  auth: SocksClientNegotiationInfoV6['auth'];
  clientRequestInfo: ClientRequestInfo;
}
