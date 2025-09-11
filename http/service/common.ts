import {IncomingHttpHeaders, OutgoingHttpHeader, OutgoingHttpHeaders} from 'http';
import {deepMergeByConcat, Env, deepClone} from '../../external';
import {HttpServerConfig} from '../../types';
import {getDefaultTlsConfig} from '../../net';

export function getDefaultHttpsConfig(options?: {env?: Env}): HttpServerConfig {
  const {env = process.env.NODE_ENV} = options ?? {};
  const tlsOptions = getDefaultTlsConfig();
  if (env === Env.elif) {
    return {
      host: '0.0.0.0',
      port: 443,
      options: tlsOptions,
    };
  } else {
    return {
      host: '0.0.0.0',
      port: 4443,
      options: tlsOptions,
    };
  }
}

type CookieObject = Record<string, string | string[]>;
function cookieStrToObj(str: string) {
  const obj = str
    .split(/; */)
    .map(it => {
      const [key, ...values] = it.split('=');
      return [key, values.join('=')];
    })
    .reduce<CookieObject>((sum, it) => {
      return {
        ...sum,
        [it[0]]: it[1],
      };
    }, {});
  return obj;
}
function cookieArrayToObj(str: string[]) {
  return cookieStrToObj(str.join('; '));
}

function cookieObjToStr(obj: CookieObject) {
  const str = Object.entries(obj)
    .reduce<[string, string][]>((sum, [key, value]) => {
      if (Array.isArray(value)) {
        const list: [string, string][] = value.map(it => [key, it]);
        return [...sum, ...list];
      } else {
        return [...sum, [key, value] as [string, string]];
      }
    }, [])
    .map(([key, value]) => {
      return `${key}=${value}`;
    })
    .join('; ');
  return str;
}

export function mergeCookie(first?: OutgoingHttpHeader, second?: OutgoingHttpHeader): string {
  if (!first && !second) {
    return undefined;
  }
  first = (Array.isArray(first) ? first.join(' ;') : first) as string;
  second = (Array.isArray(second) ? second.join(' ;') : second) as string;
  if (first && second) {
    const obj1 = cookieStrToObj(first);
    const obj2 = cookieStrToObj(second);
    const obj = deepMergeByConcat(obj1, obj2);
    return cookieObjToStr(obj);
  }
  if (first) {
    return first;
  }
  if (second) {
    return second;
  }
}

export function mergeHttpHeaders(
  headers1?: IncomingHttpHeaders | OutgoingHttpHeaders,
  headers2?: IncomingHttpHeaders | OutgoingHttpHeaders
) {
  if (!headers1 && !headers2) {
    return {};
  }
  if (headers1 && headers2) {
    const {cookie: cookie1, ...rest1} = headers1;
    const {cookie: cookie2, ...rest2} = headers2;
    const cookie = mergeCookie(cookie1, cookie2);
    // use deepMergeByConcat???
    return {
      cookie,
      ...rest1,
      ...rest2,
    };
  }
  if (headers1) {
    return deepClone(headers1);
  } else if (headers2) {
    return deepClone(headers2);
  }
}
