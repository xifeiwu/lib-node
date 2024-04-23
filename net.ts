import os from 'os';
import {Writable} from 'stream';
import net, {ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {logWithColor} from './index';
import {isString, isNumber} from './external';
import {httpFirstLineReg} from './constants';
import {HttpFirstLineInfo} from './types';

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
export async function isPortOpen(port: number, host: string = '127.0.0.1') {
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
    const isOpen = await isPortOpen(port, host);
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
    const isOpen = await isPortOpen(port, host);
    if (!isOpen) {
      return port;
    }
    port++;
  }
  throw new Error('not free port found');
}

export function handleSocketEvents(
  socket: Socket,
  options?: {
    isServer?: boolean;
    color?: Parameters<typeof logWithColor>[0];
    onData?: (chunk: Buffer) => void;
  }
) {
  if (!socket) {
    return;
  }
  const {isServer = false, color = 'black', onData} = options ?? {};
  if (!socket) {
    logWithColor(color, `socket is undefined`);
    return;
  }
  const {localAddress, localPort, remoteAddress, remotePort} = socket;
  const local = `${localAddress}:${localPort}`;
  const remote = `${remoteAddress}:${remotePort}`;
  const tag = [local, '<-', remote].join('');
  logWithColor(color, `start listen events on socket: ${tag}`);
  socket.on('data', chunk => {
    if (onData) {
      return onData(chunk);
    }
    logWithColor(color, `${tag} data:`);
    logWithColor(color, chunk);
    if (isServer) {
      socket.writable && socket.write(chunk);
    }
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
  config: {
    host?: string;
    port?: number;
    options?: ServerOpts;
  },
  handleConnection: (socket: Socket) => void
) {
  const {host = '127.0.0.1', port = await getAFreePort(), options} = config;
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
  options?: {
    startChar?: string;
    str?: string;
    maxCount?: number;
    end?: string;
    interval?: number;
  }
) {
  let resolve: () => void;
  const {startChar, str, end, interval = 500, maxCount = 3} = options ?? {};
  const content: string[] = [];
  let cnt = 0;
  if (str) {
    while (cnt < maxCount) {
      content[cnt++] = str;
    }
  } else if (startChar) {
    const startCharCode = startChar.charCodeAt(0);
    while (cnt < maxCount) {
      content[cnt] = String.fromCharCode(startCharCode + cnt);
      cnt++;
    }
  } else {
    const startCharCode = 'a'.charCodeAt(0);
    while (cnt < maxCount) {
      content[cnt] = String.fromCharCode(startCharCode + cnt);
      cnt++;
    }
  }
  const intervalTag = setInterval(() => {
    if (content.length > 0) {
      writer.write(content.shift());
    } else {
      clearInterval(intervalTag);
      if (end !== undefined) {
        writer.end(end);
      }
      resolve();
    }
  }, interval);
  return new Promise<void>(res => (resolve = res));
}

type ProtocolInfo =
  | {
      protocol: 'http';
      info: HttpFirstLineInfo;
    }
  | {
      protocol: 'socks5';
    };
export function getProtocolInfoByFirstChunk(chunk: Buffer): ProtocolInfo {
  const index = chunk.findIndex((it, index) => {
    return it === 0x0d && chunk[index + 1] === 0x0a;
  });
  const firstLine = (index > 0 ? chunk.subarray(0, index) : chunk).toString('utf-8');
  if (index !== -1) {
    const execHttpReg = httpFirstLineReg.exec(firstLine);
    if (execHttpReg) {
      const [method, url, httpVersion] = execHttpReg.slice(1);
      return {
        protocol: 'http',
        info: {
          method,
          url,
          httpVersion,
        },
      };
    }
  } else {
    if (0x05 === chunk[0]) {
      return {
        protocol: 'socks5',
      };
    }
  }
}
