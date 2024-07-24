import { Transform, pipeline } from 'stream';
import { getCipher, getDcipher, getIv, ivLength } from './cipher';
import { toBuffer } from '../external';

export async function test() {
  const iv = getIv(ivLength);
  const { cipher } = getCipher(iv);
  const dcipher = getDcipher(iv);
  const socket2Service = new Transform({
    transform(chunks, enc, cb) {
      // this.push(toBuffer(["feed: ", chunks]));
      this.push(chunks);
      cb && cb();
    },
  });
  const socket = new Transform({
    transform(chunks, enc, cb) {
      console.log(`consume: ${chunks.toString()}`);
      // this.push(chunks);
      cb && cb();
    },
  });
  // socket.on("data", (chunk) => {
  //   console.log('on data:');
  //   console.log(chunk.toString());
  // });
  pipeline(socket, cipher, socket2Service, (err) => {
    console.log(err);
  });
  pipeline(socket2Service, dcipher, socket, (err) => {
    console.log(err);
  });

  // pipeline(socket, socket2Service, (err) => {
  //   console.log(err);
  // });
  // pipeline(socket2Service, socket, (err) => {
  //   console.log(err);
  // });

  // socket.pipe(socket2Service).pipe(process.stdout);
  // socket.pipe(socket2Service).pipe(socket);
  // socket.pipe(cipher).pipe(process.stdout);
  socket.push('abc');
  socket.push('def');
  socket.push(null);
  // socket.write('abc');
}

export async function asStream() {
  // getRea

}
