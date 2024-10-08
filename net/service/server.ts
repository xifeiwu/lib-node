import fs from 'fs';
import path from 'path';
import net, {Socket} from 'net';
import {isString} from '../../external';
import {SocketServerInfo, TcpServerConfig} from '../../types';
import {
  DEFAULT_SOCKET_DIR,
  SOCKET_FILE_SUFFIX,
  getAFreePort,
  getFilePathInfo,
  makeSureDirExist,
  startSocketClient,
} from '../../index';

function checkPermissionBeforeCreateDir(dirname: string) {
  if (dirname.startsWith(process.env.HOME)) {
    makeSureDirExist(dirname);
  } else {
    throw new Error(`Don't have permission to create dir: ${dirname}`);
  }
}
/**
 * 1. socketPath can be fullPath, or basename(will use dir DEFAULT_SOCKET_DIR)
 * 2. make sure dir of socket exist.
 * @param socketPath
 * @returns
 */
export function getSocketPath(socketPath: string) {
  let dirname: string;
  let basename: string;
  if (isString(socketPath)) {
    if (socketPath.startsWith('/')) {
      const pathInfo = getFilePathInfo(socketPath);
      dirname = pathInfo.dirname;
      basename = pathInfo.basename;
    } else if (!socketPath.includes('/')) {
      basename = socketPath;
    } else {
      throw new Error(
        `socketPath in format of string can only be fullpath or basename only, basename should not contain character /`
      );
    }
  }
  if (dirname === undefined) {
    dirname = DEFAULT_SOCKET_DIR;
  }
  if (basename === undefined) {
    basename = process.pid + '';
  }
  if (!basename.endsWith(SOCKET_FILE_SUFFIX)) {
    basename += SOCKET_FILE_SUFFIX;
  }
  checkPermissionBeforeCreateDir(dirname);
  socketPath = path.join(dirname, basename);
  return socketPath;
}

export async function startSocketServer(
  handleConnection: (socket: Socket) => void,
  config?: TcpServerConfig
) {
  let {host, port, path, options} = config ?? {};
  if (path !== undefined) {
    path = getSocketPath(path);
    /** Check whether file already used as socket file */
    if (fs.existsSync(path) && path.endsWith(SOCKET_FILE_SUFFIX)) {
      try {
        await startSocketClient({path});
        throw new Error(`The socket path ${path} is already in use by another socket server`);
      } catch (err) {
        /** Remove socket file if not in use */
        fs.unlinkSync(path);
      }
    }
  } else {
    host = host ?? '';
    port = port ?? (await getAFreePort());
  }
  return new Promise<SocketServerInfo>((res, rej) => {
    const server = net.createServer(options, handleConnection);
    server.on('listening', () => {
      res({host, port, path, server});
    });
    server.on('error', err => {
      rej(err);
    });
    if (path) {
      server.listen(path);
    } else {
      server.listen(port, host);
    }
  });
}
