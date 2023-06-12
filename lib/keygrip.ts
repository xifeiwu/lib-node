/*!
 * refer from https://github.com/crypto-utils/keygrip/blob/master/index.js
 * keygrip
 * Copyright(c) 2011-2014 Jed Schmidt
 * MIT Licensed
 */

'use strict';

import crypto, {BinaryLike, BinaryToTextEncoding} from 'crypto';

// var compare = require('tsscmp')

function compare(first: string, second: string) {
  return first === second;
}

export interface IKeygrip {
  sign: (data: BinaryLike) => string;
  verify: (data: BinaryLike, digest: string) => boolean;
}
export default function keygrip(
  keys: string[],
  algorithm: string = 'sha1',
  encoding: BinaryToTextEncoding = 'base64'
): IKeygrip {
  if (!Array.isArray(keys) || keys.length === 0) {
    throw new Error('Keys must be provided.');
  }

  const sign = (data: BinaryLike, key: BinaryLike) => {
    return crypto
      .createHmac(algorithm, key)
      .update(data)
      .digest(encoding)
      .replace(/\/|\+|=/g, function(x) {
        return {'/': '_', '+': '-', '=': ''}[x];
      });
  };
  const index = (data: BinaryLike, digest: string) => {
    for (let i = 0, l = keys.length; i < l; i++) {
      if (compare(digest, sign(data, keys[i]))) {
        return i;
      }
    }

    return -1;
  };

  return {
    sign(data: BinaryLike) {
      return sign(data, keys[0]);
    },
    verify(data: BinaryLike, digest: string) {
      return index(data, digest) > -1;
    },
  };
}
