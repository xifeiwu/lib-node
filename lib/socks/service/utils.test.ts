// import {EMethod} from './types';
import assert from 'assert';
import {isIP} from 'net';
import {EMethod, EAddressType} from '../types/v5';
import {
  getMatchedProxyConfig,
  listenTimeOut,
  targetServiceInfoToBuffer,
  bufferToTargeServiceInfo,
  getAddressType,
} from './utils';

function assertSameIpv6(a: string, b: string) {
  assert.equal(isIP(a), 6, `expected ipv6 address: ${a}`);
  assert.equal(isIP(b), 6, `expected ipv6 address: ${b}`);
  assert.deepEqual(
    targetServiceInfoToBuffer({address: a, port: 80}),
    targetServiceInfoToBuffer({address: b, port: 80})
  );
}

export function testIpv6AddressEncoding() {
  const cases = [
    {address: '::1', port: 8080},
    {address: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', port: 443},
    {address: '2001:db8::8a2e:370:7334', port: 443},
    {address: '::ffff:127.0.0.1', port: 3000},
  ];

  for (const {address, port} of cases) {
    assert.equal(getAddressType(address), EAddressType.IPV6);

    const encoded = targetServiceInfoToBuffer({address, port});
    assert.equal(encoded[0], EAddressType.IPV6);

    const decoded = bufferToTargeServiceInfo(encoded);
    assert.equal(decoded.port, port);
    assertSameIpv6(decoded.address, address);

    const socksRequest = Buffer.concat([Buffer.from([0x05, 0x01, 0x00]), encoded]);
    const fromRequest = bufferToTargeServiceInfo(socksRequest.subarray(3));
    assert.equal(fromRequest.port, port);
    assertSameIpv6(fromRequest.address, address);
  }
}

export function testGetMatchedProxyConfig() {
  const proxyAsSocketClientConfigList = [
    {
      methodList: [
        {method: EMethod.NoAuth},
        {method: EMethod.UserPass, info: {username: 'elif.site', password: 'socks5'}},
      ],
      socketConfig: {
        host: 'elif.site',
        port: 3307,
      },
      matches: [
        /google/,
        /medium.com/,
        /bonus.ly/,
        /youtube.com/,
        /github.com/,
        /formulae.brew.sh/,
        /chrome\.com/,
        'stackoverflow.com',
        'www.howtogeek.com',
        /imgur\.com/,
        /wikipedia/,
        /v2ex.com/,
      ],
    },
  ];

  const proxyAsClientConfig = (proxyAsSocketClientConfigList ?? []).find(
    getMatchedProxyConfig.bind(null, {
      command: 1,
      addressType: 3,
      address: 'v9b7qjpl6dw0.statuspage.io',
      port: 443,
    })
  );
  console.log(proxyAsClientConfig);
}

export async function testListenTimeOut() {
  try {
    const result = await new Promise((res, rej) => {
      const timeout = listenTimeOut(rej, {waitMs: 3000});
      setTimeout(() => {
        clearTimeout(timeout);
        res('success');
      }, 2000);
    });
    console.log(result);
  } catch (err) {
    console.log(err);
  }
}
