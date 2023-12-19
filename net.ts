import os from 'os';
import {Writable} from 'stream';
import net, {ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {logWithColor} from './index';
import {isString, isNumber} from './fe';

export function getLocalIP() {
  let localIP = null;
  const ifaces = os.networkInterfaces();
  const keys = ['en0', 'en1', 'en2', 'en3', 'en4', 'en5', 'em0', 'em1', 'em2', 'em3', 'em4', 'em5', 'eth0'];
  let iface: os.NetworkInterfaceInfo[] | undefined;
  keys.forEach(key => {
    if (key in ifaces && Array.isArray(ifaces[key])) {
      iface = ifaces[key];
    }
  });
  [].slice.call(iface).forEach((iface: os.NetworkInterfaceInfo) => {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      return;
    }
    localIP = iface.address;
  });
  return localIP;
}

// check if the port of host is opened or not
export async function isPortOpen(host: string, port: number) {
  return new Promise((resolve, reject) => {
    try {
      const socket = net.createConnection({host, port});
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        // console.log('timeout');
        socket.destroy();
        resolve(false);
      });
      socket.on('error', err => {
        // console.log(`${port} error`);
        resolve(false);
      });
    } catch (err) {
      resolve(false);
    }
  });
}

// scan port list and show the port opened
export async function portsScan(host: string, endPort: number = 10000) {
  const startPort = 20;
  let port = startPort;
  while (port < endPort) {
    const isOpen = await isPortOpen(host, port);
    if (isOpen) {
      console.log(port);
    }
    port++;
  }
}

// 获取一个未被使用的端口（默认从3000端口开始）
export async function getAFreePort(startPort: string | number = 3000) {
  const host = '127.0.0.1';
  const endPort = 10000;
  if (isString(startPort)) {
    startPort = parseInt(startPort as string, 10);
  }
  let port: number = (isNumber(startPort) ? startPort : 3000) as number;
  while (port < endPort) {
    const isOpen = await isPortOpen(host, port);
    if (!isOpen) {
      return port;
    }
    port++;
  }
  throw new Error('not free port found');
}

/**
If the stream is connecting socket.readyState is opening.
If the stream is readable and writable, it is open.
If the stream is readable and not writable, it is readOnly.
If the stream is not readable and writable, it is writeOnly.
 */

export function handleSocketEvents(
  socket: Socket,
  options?: {
    isServer?: boolean;
    color?: Parameters<typeof logWithColor>[0];
    onData?: (chunk: Buffer) => void;
  }
) {
  const {
    isServer = false,
    color = 'black',
    onData = isServer
      ? chunk => {
          socket.writable && socket.write(chunk);
        }
      : chunk => {
          logWithColor(color, chunk);
        },
  } = options;
  const host = isServer ? socket.remoteAddress : socket.localAddress;
  const port = isServer ? socket.remotePort : socket.localPort;
  const tag = host + ':' + port;
  socket.on('data', chunk => {
    onData(chunk);
  });
  socket.on('end', () => {
    logWithColor(color, `socket ${tag} end.`);
  });
  socket.on('error', err => {
    logWithColor(color, `socket ${tag} error:`, err);
  });
  socket.on('close', hadError => {
    logWithColor(color, `socket ${tag} close${hadError ? ' [hadError].' : '.'}`);
  });
}

export async function startSocketClient(options: TcpNetConnectOpts) {
  return new Promise<Socket>((res, rej) => {
    const client = net.createConnection(options);
    client.on('ready', () => {
      res(client);
    });
    client.on('error', err => {
      rej(err);
    });
    client.on('timeout', () => {
      rej('timeout');
    });
  });
}

export async function startSocketServer(
  options: ServerOpts,
  config: {
    host?: string;
    port?: number;
    handleConnection: (socket: Socket) => void;
  }
) {
  const {handleConnection, host = '127.0.0.1', port = await getAFreePort()} = config;
  // const host = '0.0.0.0';
  return new Promise<{host: string; port: number}>((res, rej) => {
    const server = net.createServer(options, handleConnection);
    server.on('listening', () => {
      res({host, port});
    });
    server.on('error', err => {
      rej(err);
    });
    server.listen(port, host);
  });
}

export function writeDataByInterval(
  writer: Writable,
  maxCount: number,
  options: {
    startChar?: string;
    str?: string;
    end?: string;
  }
) {
  const {startChar, str, end} = options;
  const content: string[] = [];
  let cnt = 0;
  if (str) {
    while (cnt < maxCount) {
      content[cnt++] = str;
    }
  } else if (startChar) {
    let startCharCode = startChar.charCodeAt(0);
    while (cnt < maxCount) {
      content[cnt] = String.fromCharCode(startCharCode + cnt);
      cnt++;
    }
  }
  let intervalTag = setInterval(() => {
    if (content.length > 0) {
      writer.write(content.shift());
    } else {
      clearInterval(intervalTag);
      if (end !== undefined) {
        writer.end(end);
      }
    }
  }, 500);
}
