import fs from 'fs';
import path from 'path';
import {writeability} from './writeablity';
import {logColorful} from '../../log';
export async function testWriteability() {
  const fw = fs.createWriteStream(path.join(__dirname, 'test-writeability'));
  const speedInfo = await writeability(fw, {
    intervalCb: ({speedWord}) => {
      logColorful({}, speedWord);
    },
  });
  logColorful({}, speedInfo);
}
