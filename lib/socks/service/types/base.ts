import {ETargetServiceConnectState} from './v5';

export interface RepliedClientRequest {
  reply: ETargetServiceConnectState;
  address: string;
  port: number;
}
