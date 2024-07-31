import {ETargetServiceConnectState} from './v5';

export interface ServerReplyClientRequest {
  reply: ETargetServiceConnectState;
  address: string;
  port: number;
}
