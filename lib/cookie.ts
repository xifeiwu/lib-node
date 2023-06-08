/*!
 * refer from https://github.com/pillarjs/cookies/blob/master/index.js
 * cookies
 * Copyright(c) 2014 Jed Schmidt, http://jed.is/
 * Copyright(c) 2015-2016 Douglas Christopher Wilson
 * MIT Licensed
 */

'use strict';

import keygrip, {IKeygrip} from './keygrip';
import http from 'http';

/**
 * RegExp to match field-content in RFC 7230 sec 3.2
 *
 * field-content = field-vchar [ 1*( SP / HTAB ) field-vchar ]
 * field-vchar   = VCHAR / obs-text
 * obs-text      = %x80-FF
 */

var fieldContentRegExp = /^[\u0009\u0020-\u007e\u0080-\u00ff]+$/;

/**
 * RegExp to match Priority cookie attribute value.
 */

var PRIORITY_REGEXP = /^(?:low|medium|high)$/i;

/**
 * Cache for generated name regular expressions.
 */

var REGEXP_CACHE = Object.create(null);

/**
 * RegExp to match all characters to escape in a RegExp.
 */

var REGEXP_ESCAPE_CHARS_REGEXP = /[\^$\\.*+?()[\]{}|]/g;

/**
 * RegExp to match basic restricted characters for loose validation.
 */

var RESTRICTED_CHARS_REGEXP = /[;=]/;

/**
 * RegExp to match Same-Site cookie attribute value.
 */

var SAME_SITE_REGEXP = /^(?:lax|none|strict)$/i;

interface CookieConfig {
  signed?: boolean;
  secure?: boolean;
}
export class Cookies {
  request: http.IncomingMessage;
  response: http.OutgoingMessage;
  secure: boolean;
  keygrip?: IKeygrip;
  constructor(
    request: http.IncomingMessage,
    response: http.OutgoingMessage,
    options: {
      keys?: string[];
      secure?: boolean;
    } = {}
  ) {
    this.request = request;
    this.response = response;
    const {keys = [], secure = false} = options;
    if (keys.length > 0) {
      this.keygrip = keygrip(keys);
    }
  }
  get(name: string, options: CookieConfig = {}) {
    var sigName = name + '.sig',
      match,
      value,
      index;

    const header = this.request.headers['cookie'];
    if (!header) {
      return undefined;
    }
    match = header.match(getPattern(name));
    if (!match) {
      return undefined;
    }

    value = match[1];
    if (value[0] === '"') {
      value = value.slice(1, -1);
    }
    const {signed} = options;
    if (!this.keygrip || !signed) {
      return value;
    }

    const remote = this.get(sigName);
    if (!remote) {
      return undefined;
    }

    const data = name + '=' + value;
    const isVerified = this.keygrip.verify(data, remote);
    // if (!this.keys) throw new Error('.keys required for signed cookies');
    // index = this.keys.index(data, remote);

    if (!isVerified) {
      this.set({name: sigName, value: null, sign: false});
    } else {
      this.set({name: sigName, value: this.keygrip.sign(data), sign: false});
      // return value;
    }
  }
  getAll(options: CookieConfig = {}) {
    const header = this.request.headers['cookie'];
    const obj = header
      .split(';')
      .filter(it => it)
      .reduce((sum, keyValue) => {
        const values = keyValue.split('=');
        if (values.length < 2) {
          return sum;
        } else {
          return {
            ...sum,
            [values[0].trim()]: values[1].trim(),
          };
        }
      }, {});
    return obj;
  }
  getAllSigned() {
    const header = this.request.headers['cookie'];
    const obj = header
      .split(';')
      .filter(it => it)
      .reduce((sum, keyValue) => {
        const values = keyValue.split('=');
        if (values.length < 2) {
          return sum;
        } else {
          return {
            ...sum,
            [values[0].trim()]: values[1].trim(),
          };
        }
      }, {});
    return obj;
  }
  set(data: {name: string; value: string; sign?: boolean}, attr: CookieAttrs = {}) {
    const {name, value} = data;
    const {request, response, keygrip} = this;
    let headers = response.getHeader('Set-Cookie') || [];

    const signed = data.sign && !!keygrip;
    // this.secure === undefined ? request.protocol === 'https' || isRequestEncrypted(request) : Boolean(this.secure);
    if (typeof headers == 'string') {
      headers = [headers];
    }
    // const secure = attr.secure || this.secure;
    // if (!secure && attrs && attrs.secure) {
    //   throw new Error('Cannot send secure cookie over unencrypted connection');
    // }

    // cookie.secure = attrs && attrs.secure !== undefined ? attrs.secure : secure;

    // const cookieAttr = {secure};
    const cookie = new Cookie(name, value, attr);
    pushCookie(headers, cookie);

    if (signed) {
      pushCookie(headers, new Cookie(`${name}.sig`, keygrip.sign(cookie.toString()), attr));
    }
    response.setHeader('Set-Cookie', headers);
    return this;
  }
}

export interface CookieAttrs {
  path?: string;
  expires?: Date;
  domain?: string;
  httpOnly?: boolean;
  priority?: string;
  sameSite?: boolean | string;
  secure?: boolean;
  overwrite?: boolean;
  maxAge?: number;
}
class Cookie {
  name: string;
  value: string;
  attrs: CookieAttrs;
  constructor(name: string, value: string, attrs: CookieAttrs = {}) {
    if (!fieldContentRegExp.test(name) || RESTRICTED_CHARS_REGEXP.test(name)) {
      throw new TypeError('argument name is invalid');
    }
    if (value && (!fieldContentRegExp.test(value) || RESTRICTED_CHARS_REGEXP.test(value))) {
      throw new TypeError('argument value is invalid');
    }
    if (!value) {
      attrs.expires = new Date(0);
      attrs.maxAge = 0;
    }
    if (attrs.path && !fieldContentRegExp.test(attrs.path)) {
      throw new TypeError('option path is invalid');
    }
    if (attrs.domain && !fieldContentRegExp.test(attrs.domain)) {
      throw new TypeError('option domain is invalid');
    }

    if (typeof attrs.maxAge === 'number' ? isNaN(attrs.maxAge) || !isFinite(attrs.maxAge) : attrs.maxAge) {
      throw new TypeError('option maxAge is invalid');
    }

    if (attrs.priority && !PRIORITY_REGEXP.test(attrs.priority)) {
      throw new TypeError('option priority is invalid');
    }

    if (attrs.sameSite && attrs.sameSite !== true && !SAME_SITE_REGEXP.test(attrs.sameSite)) {
      throw new TypeError('option sameSite is invalid');
    }
    const {
      path = '/',
      maxAge,
      expires,
      domain,
      priority,
      httpOnly = true,
      sameSite = false,
      secure = false,
      overwrite = false,
    } = attrs;
    // let expires = attrs.expires;
    // if (maxAge && !expires) {
    //   expires = new Date(Date.now() + maxAge);
    // }
    this.name = name;
    this.value = value;
    this.attrs = {
      path,
      maxAge,
      expires,
      domain,
      httpOnly,
      priority,
      sameSite,
      secure,
      overwrite,
    };
  }
  toString() {
    return this.name + '=' + this.value;
  }
  toHeader() {
    const results: string[] = [this.toString()];
    const {path = '/', maxAge, expires, domain, priority, sameSite, secure, httpOnly} = this.attrs;
    path && results.push(`path=${path}`);
    maxAge && results.push(`max-age=${maxAge}`);
    expires && results.push(`expires=${expires.toUTCString()}`);
    domain && results.push(`domain=${domain}`);
    priority && results.push(`priority=${priority.toLowerCase()}`);
    sameSite && results.push(`samesite=${sameSite === true ? 'strict' : sameSite.toLowerCase()}`);
    secure && results.push('secure');
    httpOnly && results.push('httpOnly');
    return results.join('; ');
  }
}

/**
 * Get the pattern to search for a cookie in a string.
 * @param {string} name
 * @private
 */

function getPattern(name) {
  if (!REGEXP_CACHE[name]) {
    REGEXP_CACHE[name] = new RegExp(
      '(?:^|;) *' + name.replace(REGEXP_ESCAPE_CHARS_REGEXP, '\\$&') + '=([^;]*)'
    );
  }

  return REGEXP_CACHE[name];
}

/**
 * Get the encrypted status for a request.
 *
 * @param {object} req
 * @return {string}
 * @private
 */

// function isRequestEncrypted(req: http.IncomingMessage) {
//   return req.socket ? req.socket.encrypted : req.connection.encrypted;
// }

function pushCookie(headers, cookie) {
  if (cookie.overwrite) {
    for (var i = headers.length - 1; i >= 0; i--) {
      if (headers[i].indexOf(cookie.name + '=') === 0) {
        headers.splice(i, 1);
      }
    }
  }
  headers.push(cookie.toHeader());
}
