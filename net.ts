import * as os from 'os';
import * as net from 'net';
import {isString, isNumber} from './common';

export function getLocalIP() {
  var localIP = null;
  var ifaces = os.networkInterfaces();
  var keys = ['en0', 'en1', 'en2', 'en3', 'en4', 'en5', 'em0', 'em1', 'em2', 'em3', 'em4', 'em5', 'eth0'];
  let iface: os.NetworkInterfaceInfo[] | undefined;
  keys.forEach(function (key) {
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
  var port = startPort;
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
