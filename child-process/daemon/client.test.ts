import {logColorful} from '../../log';
import {checkSocketActivity, ping} from './client';
import {socketDir} from './service';

export async function testPing() {
  const response = await ping('/Users/wuxifei/.daemon/sockets/48666.socket');
  logColorful({}, response);
}
export async function testCheckSocketActivity() {
  const results = await checkSocketActivity(socketDir);
  logColorful({}, results);
}
