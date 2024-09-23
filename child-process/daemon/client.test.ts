import {logColorful} from '../../log';
import {checkSocketActivity} from './client';
import {socketDir} from './service';

export async function testCheckSocketActivity() {
  const results = await checkSocketActivity(socketDir);
  logColorful({}, results);
}
