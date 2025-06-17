import path from 'path';
export const DAEMON_ROOT_DIR = path.join(process.env.HOME, '.daemon');
export const DAEMON_SOCKET_DIR = path.join(DAEMON_ROOT_DIR, 'sockets');
export const DEFAULT_SOCKET_DIR = DAEMON_SOCKET_DIR;
export const SOCKET_FILE_SUFFIX = '.socket';

export const uploadDirOnHome = path.resolve(process.env.HOME, 'uploads');
export const uploadDirOnCwd = path.resolve(process.cwd(), 'uploads');

export const httpHeaderLineReg = /^ *([^:]*): *(.*)(?:\r\n)?$/i;
