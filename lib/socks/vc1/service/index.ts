import {SocksVersion} from '../../types';

export * from './cipher';

export const PROTOCOL_BYTE: SocksVersion = 1;

export const clientState = {
  sentConnectionInfo: 'sent connection info',
  gotRepliedTargetServiceInfo: 'got replied target service info',
};
