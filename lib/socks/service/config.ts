import {ECommand, UserPassInfo} from '../types/v5';

/**
 * global basic auth config
 */
export const basicAuth: UserPassInfo = {
  username: 'abc',
  password: 'dddd',
};

export const DEFAULT_COMMAND = ECommand.CONNECT;
// export const DEFAULT_COMMAND = ECommand.ECHO;
