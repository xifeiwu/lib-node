import {toBuffer} from '../external';
import {address2Buffer, port2Buffer} from '../service';

export async function bufferConvert() {
  const address = '127.0.0.1';
  const addressType = 1;
  const command = 1;
  const port = 3005;

  const buffer = toBuffer([
    5,
    command,
    0,
    addressType,
    address2Buffer(address, addressType),
    port2Buffer(port),
  ]);
  console.log(buffer);
}
