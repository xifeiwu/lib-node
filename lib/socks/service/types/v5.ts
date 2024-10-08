import {RequestTarget} from './base';

/**
 * o  X'00' NO AUTHENTICATION REQUIRED
 * o  X'01' GSSAPI
 * o  X'02' USERNAME/PASSWORD
 * o  X'03' to X'7F' IANA ASSIGNED
 * o  X'80' to X'FE' RESERVED FOR PRIVATE METHODS
 * o  X'FF' NO ACCEPTABLE METHODS
 */
export enum EMethod {
  NoAuth = 0x00,
  GSSApi = 0x01,
  UserPass = 0x02,
  NoAcceptable = 0xff,
}

export interface UserPassInfo {
  username: string;
  password: string;
}
export interface MethodUserPass {
  method: EMethod.UserPass;
  info: UserPassInfo;
}
export type MethodInfo = {method: EMethod.NoAuth} | MethodUserPass;

export enum ECommand {
  CONNECT = 0x01,
  BIND = 0x02,
  UDP = 0x03,
}

export enum EAddressType {
  IPV4 = 0x01,
  DOMAINNAME = 0x03,
  IPV6 = 0x04,
}

export interface RequestTargetV5 {
  command?: ECommand;
  addressType?: EAddressType;
  address: string;
  port: number;
}

export interface RequestTargetV5Response {
  reply: EHandleRequestTargetState;
  addressType?: EAddressType;
  address: string;
  port: number;
}
/**
 * +----+-----+-------+------+----------+----------+
 * |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
 * +----+-----+-------+------+----------+----------+
 * | 1  |  1  | X'00' |  1   | Variable |    2     |
 * +----+-----+-------+------+----------+----------+
 * Where:
 * o  VER    protocol version: X'05'
 * o  REP    Reply field:
 * o  X'00' succeeded
 *     o  X'01' general SOCKS server failure
 *     o  X'02' connection not allowed by ruleset
 *     o  X'03' Network unreachable
 *     o  X'04' Host unreachable
 *     o  X'05' Connection refused
 *     o  X'06' TTL expired
 *     o  X'07' Command not supported
 *     o  X'08' Address type not supported
 *     o  X'09' to X'FF' unassigned
 *     o  RSV    RESERVED
 * o  ATYP   address type of following address
 */
export enum EHandleRequestTargetState {
  succeeded = 0x00,
  general_SOCKS_server_failure = 0x01,
  connection_not_allowed_by_ruleset = 0x02,
  Network_unreachable = 0x03,
  Host_unreachable = 0x04,
  Connection_refused = 0x05,
  TTL_expired = 0x06,
  Command_not_supported = 0x07,
  Address_type_not_supported = 0x08,
  to_FF_unassigned = 0x09,
}

/** For Client Side */
export interface NegotiationInfoClient {
  methodList?: Array<MethodInfo>;
  requestTarget: RequestTarget;
}
/** For Server Side */
export interface ServerConfig extends Pick<NegotiationInfoClient, 'methodList'> {}
export interface NegotiationResult {
  method: MethodInfo;
  requestTarget: RequestTargetV5;
  requestTargetResponse?: RequestTargetV5Response;
}
