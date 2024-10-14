import {Socket, TcpNetConnectOpts} from 'net';
import {NegotiationInfoClient as NegotiationInfoV5, NegotiationResult as NegotiationResultV5} from './v5';
import {NegotiationInfoClient as NegotiationInfoVc1, NegotiationResult as NegotiationResultVc1} from './vc1';
import {StateTracer} from './base';
import {SocksError} from '../utils';

/**
 * if type is string, will treat as http href and get socket by http upgrade protocol
 */
export type TargetSocksServer = TcpNetConnectOpts | string;

export interface NegotiationInfo {
  5: NegotiationInfoV5;
  1: NegotiationInfoVc1;
}

export interface NegotiationResult {
  5: NegotiationResultV5;
  1: NegotiationResultVc1;
}

export type SocksVersion = 5 | 1;

export type SocksClientConfig<Version extends SocksVersion = any> = NegotiationInfo[Version] & {
  /** Identify socks version */
  socksVersion: Version;
  /** target socks server */
  socksServer: TargetSocksServer;
};

export interface SocksClientInfo<Version extends SocksVersion = any> {
  socksVersion: Version;
  negotiationResult?: NegotiationResult[Version];
  error?: SocksError;
  socket?: Socket;
  stateTracer?: StateTracer;
}

export type NegotiationWithServer<Version extends SocksVersion> = (
  socket: Socket,
  negotiationInfo: NegotiationInfo[Version],
  stateTracer?: StateTracer
) => Promise<NegotiationResult[Version]>;
