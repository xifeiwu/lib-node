import path from 'path';
export const PROCESS_MANAGEMENT_ROOT_DIR = path.join(process.env.HOME, '.process-management');
/**
 * @deprecated
 */
export const DAEMON_SOCKET_DIR = PROCESS_MANAGEMENT_ROOT_DIR;//path.join(PROCESS_MANAGEMENT_ROOT_DIR, 'sockets');
/**
 * @deprecated
 */
export const DEFAULT_SOCKET_DIR = DAEMON_SOCKET_DIR;
export const SOCKET_FILE_SUFFIX = '.socket';

export const uploadDirOnHome = path.resolve(process.env.HOME, 'uploads');
export const uploadDirOnCwd = path.resolve(process.cwd(), 'uploads');
