
import path from 'path';
export const DAEMON_ROOT_DIR  = path.join(process.env.HOME, '.daemon');
export const DAEMON_SOCKET_DIR = path.join(DAEMON_ROOT_DIR, 'sockets');
export const SOCKET_FILE_SUFFIX = '.socket';