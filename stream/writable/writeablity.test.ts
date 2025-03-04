import fs from 'fs';
import path from 'path';
import {writeability} from './writeablity';
import {logColorful} from '../../log';
import {Readable} from 'stream';
import {wordToByte} from '../../external';
export async function testWriteabilityOfFileWriting() {
  const fw = fs.createWriteStream(path.join(__dirname, 'test-writeability'));
  const speedInfo = await writeability(fw, {
    intervalCb: ({speedWord}) => {
      logColorful({}, speedWord);
    },
  });
  logColorful({}, speedInfo);
}
export async function testWriteabilityOfStdout() {
  const speedInfo = await writeability(process.stdout, {
    intervalCb: ({speedWord}) => {
      logColorful({}, speedWord);
    },
  });
  logColorful({}, speedInfo);
}

/**
 * Compared to Buffer.alloc, getRandomBase64String cost more time.
 */
export async function writeWayTwo() {
  const chunkSize = 64 * 1024;
  let dataSent = 0;

  const reader = new Readable({
    read() {
      /** getRandomBase64String is a large cost function? */
      // const buf = Buffer.from(getRandomBase64String(chunkSize));
      const buf = Buffer.alloc(chunkSize);
      dataSent += buf.byteLength;
      if (dataSent > wordToByte('1g')) {
        this.push(null);
        return;
      }
      this.push(buf);
    },
  });

  let startTime = Date.now();
  const fw = fs.createWriteStream(path.join(__dirname, 'test-writeability'));
  reader.pipe(fw);
  await new Promise<void>(res => {
    reader.on('end', () => {
      res();
    });
  });
  console.log(Date.now() - startTime);
}
