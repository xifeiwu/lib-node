import {Socket, TcpNetConnectOpts} from 'net';
import {SocketInfo} from '../external';
import {BinaryLike} from 'crypto';
import {
  RequestTargetV5 as RequestTargetV5,
  RequestTargetV5Response,
  EMethod,
  NegotiationInfo as NegotiationInfoV5,
  NegotiationResult as NegotiationResultV5,
} from './v5';
import {NegotiationInfo as NegotiationInfoVc1, NegotiationResult as NegotiationResultVc1} from './vc1';

export type TargetSocket = TcpNetConnectOpts | string;

export interface NegotiationInfo {
  v5: NegotiationInfoV5;
  vc1: NegotiationInfoVc1;
}

export interface NegotiationResult {
  v5: NegotiationResultV5;
  vc1: NegotiationResultVc1;
}

export type SocksVersion = keyof NegotiationInfo;

export type SocksClientConfig<Version extends SocksVersion> = NegotiationInfo[Version] & {
  /** Identify socks version */
  socksVersion: Version;
  /** target socks server */
  targetSocksServer: TargetSocket;
};

/**
 * Different between Tracer and Status
 * 1. Tracer used on record logic process, Status used to store important info of Socks end.
 */
interface TracerInfoV5 {
  method: EMethod;
}
interface TracerInfoV6 {
  iv: BinaryLike;
}
export interface TracerInfo extends TracerInfoV5, TracerInfoV6 {
  targetSocksServer: TargetSocket;
  requestTarget?: RequestTargetV5;
  respondOfRequestTarget: RequestTargetV5Response;
}

export type TracerKey = keyof TracerInfo;
export interface TracerItem {
  key: TracerKey;
  value: TracerInfo[TracerKey];
}

export interface SocksClientStatus {
  socket?: Socket;
  socketInfo?: Partial<SocketInfo>;
  stateTracer: Array<string | TracerItem>;
  clientRequestInfo?: RequestTargetV5;
  respondClientRequest?: RequestTargetV5Response;
}

export type NegotiationWithServer<Version extends SocksVersion> = (
  socket: Socket,
  config: NegotiationInfo[Version],
  clientInfo?: SocksClientStatus
) => Promise<NegotiationResult[Version]>;
