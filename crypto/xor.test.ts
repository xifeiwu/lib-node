import {Duplex, Transform, pipeline} from 'stream';
import {getIv, defaultIvBytes, xorData, getXorTransform} from './xor';
import {logColorful, toBuffer} from '..';

export async function testXor() {
  const iv = getIv(3);
  const data = '初始数据';
  const decrypted = xorData(data, iv);
  logColorful({}, decrypted);
  const enctypted = xorData(decrypted, iv);
  logColorful({}, enctypted);
}

export async function asStream() {
  const iv = getIv(3);
  const client = new Duplex({
    read() {
      // this.push(xorData('data from client', iv));
      this.push('data from client');
    },
    write(chunk) {
      logColorful({}, 'client consume data:', chunk);
    },
  });
  const server = new Duplex({
    read() {},
    write(chunk) {
      const data = xorData(chunk, iv);
      const response = toBuffer(['response from buffer:', data]);
      logColorful({}, 'server consume data:', data);
      server.push(xorData(response, iv));
    },
  });
  pipeline(client, getXorTransform(iv), server, err => {
    console.log(err);
  });
  pipeline(server, getXorTransform(iv), client, err => {
    console.log(err);
  });
}
