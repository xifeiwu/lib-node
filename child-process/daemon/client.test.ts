import {logColorful} from '../../log';
import {checkDaemonSocketActivityByDir, ping} from './client';
import {socketDir} from './service';

export async function testPing() {
  const response = await ping('/Users/wuxifei/.daemon/sockets/84825.socket');
  logColorful({}, response);
}
export async function testCheckSocketActivity() {
  const results = await checkDaemonSocketActivityByDir(socketDir);
  logColorful({}, results);
}
