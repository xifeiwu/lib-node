import {SaveCommandInfo} from './common';

export interface GetResponseInfo extends Omit<SaveCommandInfo, 'expireTimeInSeconds' | 'command'> {
  command: 'VALUE' | 'END'
}
