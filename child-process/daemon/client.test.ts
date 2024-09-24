import {logColorful} from '../../log';
import {checkDaemonSocketActivityByDir, ping, info, stop} from './client';
import {socketDir} from './service';

const targetSocketPath = '/Users/wuxifei/.daemon/sockets/debug-server.socket';
export async function testPing() {
  const response = await ping(targetSocketPath);
  logColorful({}, response);
}

export async function testInfo() {
  const response = await info(targetSocketPath);
  logColorful({}, response);
}
export async function testStop() {
  const response = await stop(targetSocketPath);
  logColorful({}, response);
}
export async function testCheckSocketActivity() {
  const results = await checkDaemonSocketActivityByDir(socketDir);
  logColorful({}, results);
}
