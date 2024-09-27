import path from 'path';
export const DAEMON_ROOT_DIR = path.join(process.env.HOME, '.daemon');
export const DAEMON_SOCKET_DIR = path.join(DAEMON_ROOT_DIR, 'sockets');
export const DEFAULT_SOCKET_DIR = DAEMON_SOCKET_DIR;
export const SOCKET_FILE_SUFFIX = '.socket';

// POST /posts/42/comments HTTP/1.1\r\n
export const httpFirstLineReg =
  /^(get|post|put|patch|options|delete|head|connect)\s([^\s]+)\s(http\/\d\.\d)(?:\r\n)?$/i;
export const httpHeaderLineReg = /^ *([^:]*): *(.*)(?:\r\n)?$/i;
