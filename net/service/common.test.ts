import {getLocalIpAddress} from './common';

export function testGetLocalIpAddress() {
  const ipAddress = getLocalIpAddress();
  console.log(ipAddress);
}
