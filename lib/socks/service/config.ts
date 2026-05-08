import {ECommand, UserPassInfo} from '../types/v5';

/**
 * Default SOCKS username-password credentials (e.g. tests / local gateway config).
 */
export const SOCKS_AUTH_DEFAULT_USER_PASS: UserPassInfo = {
  username: 'abc',
  password: 'dddd',
};

export const SOCKS_DEFAULT_COMMAND = ECommand.CONNECT;
// export const SOCKS_DEFAULT_COMMAND = ECommand.ECHO;
