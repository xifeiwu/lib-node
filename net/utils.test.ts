import {getLocalIpAddress} from './utils';

export function testGetLocalIpAddress() {
  const ipAddress = getLocalIpAddress();
  console.log(ipAddress);
}
