
import path from 'path';
export const daemonRootDir  = path.join(process.env.HOME, '.daemon');
export const socketDir = path.join(daemonRootDir, 'sockets');
export const socketFileSuffix = '.socket';