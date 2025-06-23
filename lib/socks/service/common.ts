/** Common utils for both client and server */
import {Socket} from 'net';
import {GetWrappedSocket, SocksVersion} from '../types';
import {getWrappedSocket as getWrappedSocketVc1} from '../vc1/service';

const getWrappedSocket: Partial<{
  [version in SocksVersion]: GetWrappedSocket<SocksVersion>;
}> = {
  1: getWrappedSocketVc1,
};

export function getWrapSocketFunc(socksVersion: SocksVersion) {
  const func = getWrappedSocket[socksVersion];
  return func ? func : (socket: Socket) => socket;
}
