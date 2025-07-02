import assert from 'assert';
import {execSync} from 'child_process';
import {getHashDigest} from './hash';

export function runGetHashDigest() {
  const str = 'passwordabc';
  const sha1 = getHashDigest(str, {algorithm: 'sha1', encode: 'hex'});
  const cmdResult = execSync(`echo -n ${str} | shasum`, {shell: 'bash'}).toString();
  const [, sha1FromCommand] = cmdResult.match(/([0-9abcdef]+)/);
  assert.equal(sha1.length, 40);
  console.log(sha1);
  console.log(sha1FromCommand);
  assert.equal(sha1, sha1FromCommand);
}
