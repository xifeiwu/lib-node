import os from 'os';
import {Writable} from 'stream';
import net, {ServerOpts, Socket, TcpNetConnectOpts} from 'net';
import {isString, isNumber, formatDate} from '../external';
import {httpFirstLineReg} from '../constants';
import {ColorStyle, GetSocketOptions, HttpFirstLineProps, SocketInfo} from '../types';
import {logColorful} from '../log';

export function getLocalIpAddress() {
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
export async function checkPort(port: number, host: string = '127.0.0.1') {
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
    const isOpen = await checkPort(port, host);
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
    const isOpen = await checkPort(port, host);
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
    color?: Parameters<typeof logColorful>[0]['color'];
    maxPrintDataLength?: number;
    /** As listening on 'data' event will change flowMode, sometimes we do not want to change flowMode */
    onData?: null | ((chunk: Buffer) => void);
  }
) {
  if (!socket) {
    return;
  }
  const {isServer = false, color = 'black', maxPrintDataLength, onData} = options ?? {};
  if (!socket) {
    logColorful({color}, `socket is undefined`);
    return;
  }
  const {localAddress, localPort, remoteAddress, remotePort} = socket;
  const local = `${localAddress}:${localPort}`;
  const remote = `${remoteAddress}:${remotePort}`;
  const tag = [local, '<-', remote].join('');
  logColorful({color}, `start listen events on socket: ${tag}`);
  if (onData !== null) {
    socket.on('data', chunk => {
      if (onData) {
        return onData(chunk);
      }
      logColorful({color}, `${tag} data:`);
      logColorful(
        {
          color,
        },
        `[size: ${chunk.byteLength}]` +
          (isNumber(maxPrintDataLength) ? chunk.subarray(0, maxPrintDataLength) : chunk).toString()
      );
      if (isServer) {
        socket.writable && socket.write(chunk);
      }
    });
  }
  socket.on('end', () => {
    logColorful({color}, `socket ${tag} end.`);
  });
  socket.on('timeout', () => {
    logColorful({color}, `socket ${tag} timeout.`);
  });
  socket.on('error', err => {
    logColorful({color}, `socket ${tag} error:`, err);
    console.log(err);
  });
  socket.on('close', hadError => {
    logColorful({color}, `socket ${tag} close${hadError ? ' [hadError].' : '.'}`);
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

export async function getClientSocket(options: GetSocketOptions) {
  if (options instanceof Socket) {
    return options;
  }
  return await startSocketClient(options);
}

export async function startSocketServer(
  handleConnection: (socket: Socket) => void,
  config?: {
    host?: string;
    port?: number;
    options?: ServerOpts;
  }
) {
  const {host = '0.0.0.0', port = await getAFreePort(), options} = config ?? {};
  return new Promise<{host: string; port: number; server: net.Server}>((res, rej) => {
    const server = net.createServer(options, handleConnection);
    server.on('listening', () => {
      res({host, port, server});
    });
    server.on('error', err => {
      rej(err);
    });
    server.listen(port, host);
  });
}

/**
 * @deprecated Shoule be part of stream, not net
 * @param writer
 * @param options
 * @returns
 */
export function writeDataByInterval(
  writer: Writable,
  options?: {
    contentStr?: string;
    startChar?: string;
    maxCount?: number;
    /** string send by .end() */
    endStr?: string;
    interval?: number;
  }
) {
  let resolve: () => void;
  const {startChar, contentStr, endStr, interval = 500, maxCount = 3} = options ?? {};
  const content: string[] = [];
  let cnt = 0;
  if (contentStr) {
    while (cnt < maxCount) {
      content[cnt++] = contentStr;
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
      if (endStr !== undefined) {
        writer.end(endStr);
      }
      resolve();
    }
  }, interval);
  return new Promise<void>(res => (resolve = res));
}

type ProtocolInfo =
  | {
      protocol: 'http';
      info: HttpFirstLineProps;
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

export function getSocketInfo(socket: Socket): Partial<SocketInfo> {
  if (!socket || !(socket instanceof Socket)) {
    return {};
  }
  const {
    localAddress,
    localPort,
    remoteAddress,
    remotePort,
    readable,
    readableFlowing,
    readyState,
    writable,
    bytesWritten,
    destroyed,
    bytesRead,
    allowHalfOpen,
  } = socket;
  const local = `${localAddress}:${localPort}`;
  const remote = `${remoteAddress}:${remotePort}`;
  return {
    id: [local, '<-', remote].join(''),
    allowHalfOpen,
    readable,
    readableFlowing,
    bytesRead,
    writable,
    bytesWritten,
    destroyed,
    readyState,
    localAddress,
    localPort,
    remoteAddress,
    remotePort,
  };
}

export function watchSocketState(socket: Socket, options?: {colorStyle?: ColorStyle; bytesToPrint?: number}) {
  const {colorStyle = {}, bytesToPrint = 50} = options ?? {};
  const {color} = colorStyle;
  const printState = () => {
    logColorful({color}, getSocketInfo(socket));
  };
  // socket.allowHalfOpen = true;
  printState();
  socket.on('data', chunk => {
    const {byteLength} = chunk;
    logColorful(
      {color},
      `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on data [size: ${byteLength}]`
    );
    // console.log(chunk.toString());
    logColorful(
      {color},
      byteLength > bytesToPrint ? chunk.subarray(0, bytesToPrint).toString() + '...' : chunk.toString()
    );
    printState();
  });
  // socket.on('readable', () => {
  //   logColorful({color}, `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on readable`);
  //   printState();
  // })
  socket.on('end', () => {
    logColorful({color}, `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on end`);
    printState();
  });
  socket.on('error', err => {
    logColorful({color}, `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on error`);
    console.log(err);
    printState();
  });
  socket.on('finish', () => {
    logColorful({color}, `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on finish`);
    printState();
  });
  socket.on('close', () => {
    logColorful({color}, `[${formatDate(new Date(), 'yyyy-MM-dd hh:mm:ss.SSS')}] on close`);
    printState();
  });
}
