import path from 'path';
export const PROCESS_MANAGER_ROOT_DIR = path.join(process.env.HOME, '.process-manager');
/**
 * @deprecated
 */
export const DAEMON_SOCKET_DIR = PROCESS_MANAGER_ROOT_DIR;
/**
 * @deprecated
 */
export const DEFAULT_SOCKET_DIR = DAEMON_SOCKET_DIR;
export const SOCKET_FILE_SUFFIX = '.socket';

export const uploadDirOnHome = path.resolve(process.env.HOME, 'uploads');
export const uploadDirOnCwd = path.resolve(process.cwd(), 'uploads');
