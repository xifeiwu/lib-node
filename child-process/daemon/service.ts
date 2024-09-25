
import path from 'path';
export const DaemonRootDir  = path.join(process.env.HOME, '.daemon');
export const DaemonSocketDir = path.join(DaemonRootDir, 'sockets');
export const SocketFileSuffix = '.socket';