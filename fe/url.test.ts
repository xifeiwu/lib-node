import assert from 'assert';
import {applyPathnameParams, getUrlPropsFromConfig, urlPropsToHref, isSameUrlTarget} from './url';
import {UrlProps} from './service';
import {runFuncTestCases} from '../test';

export function testURL() {
  try {
    const url = new URL('/abc');
    assert.fail('will not arrive here');
  } catch (err) {
    console.log('will thrown Error if url string not contains origin part');
  }
  {
    /** Only use the origin part of seconday param */
    const {href, origin, pathname} = new URL('/abc', 'http://127.0.1/d/f');
    assert.deepEqual(
      {href, origin, pathname},
      {
        href: 'http://127.0.0.1/abc',
        origin: 'http://127.0.0.1',
        pathname: '/abc',
      }
    );
  }
  {
    /** Only use protocol part of secondary param, when starts with // */
    const {href, origin, pathname} = new URL('//abc', 'http://127.0.1/d/f');
    assert.deepEqual({href, origin, pathname}, {href: 'http://abc/', origin: 'http://abc', pathname: '/'});
  }
  {
    const url1 = new URL('http://127.0.1');
    const url2 = new URL('http://127.0.1/');
    for (const key of ['href', 'origin', 'pathname']) {
      assert.equal(url1[key], url2[key]);
    }
  }
  {
    /** If first param contains all part, secondary param will not work */
    const {href, origin, pathname} = new URL('http://127.0.1/abc', 'ftp://124.3.2/d/f');
    assert.deepEqual(
      {href, origin, pathname},
      {
        href: 'http://127.0.0.1/abc',
        origin: 'http://127.0.0.1',
        pathname: '/abc',
      }
    );
  }
}

export function testURLProps() {
  const str =
    'https://user:pass@example.com:8000/query/user?name=Jonathan%20Smith&age=18&name=Akara#section-2';
  const url = new URL(str);
  const {
    href,
    protocol,
    username,
    password,
    origin,
    hostname,
    host,
    port,
    pathname,
    search,
    searchParams,
    hash,
  } = url;
  const query = [...searchParams.entries()].reduce<UrlProps['query']>((sum, [key, value]) => {
    if (Object.prototype.hasOwnProperty.call(sum, key)) {
      const previousValue = sum[key];
      sum[key] = Array.isArray(previousValue) ? [...previousValue, value] : [previousValue, value];
      return sum;
    } else {
      return {
        ...sum,
        [key]: value,
      };
    }
  }, {});
  assert.deepEqual(
    {href, protocol, username, password, origin, hostname, host, port, pathname, search, query, hash},
    {
      hash: '#section-2',
      host: 'example.com:8000',
      hostname: 'example.com',
      href: str,
      origin: 'https://example.com:8000',
      username: 'user',
      password: 'pass',
      pathname: '/query/user',
      port: '8000',
      protocol: 'https:',
      search: '?name=Jonathan%20Smith&age=18&name=Akara',
      query: {
        name: ['Jonathan Smith', 'Akara'],
        age: '18',
      },
    }
  );
}
export function testApplyPathnameParams() {
  const testData: Array<{
    pathname: UrlProps['pathname'];
    pathnameParams: UrlProps['pathnameParams'];
    expected: string;
  }> = [
    /** semicolon, all props */
    {
      pathname: '/user/:id/:prop',
      pathnameParams: {
        id: 1,
        prop: 'age',
      },
      expected: '/user/1/age',
    },
    /** semicolon, props without id */
    {
      pathname: '/user/:id/:prop',
      pathnameParams: {
        prop: 'age',
      },
      expected: '/user/:id/age',
    },
    /** brace, all props */
    {
      pathname: '/user/{id}/{prop}',
      pathnameParams: {
        id: 1,
        prop: 'age',
      },
      expected: '/user/1/age',
    },
    /** brace, props without id */
    {
      pathname: '/user/{id}/{prop}',
      pathnameParams: {
        prop: 'age',
      },
      expected: '/user/{id}/age',
    },
  ];
  for (const it of testData) {
    const {pathname, pathnameParams, expected} = it;
    assert.equal(expected, applyPathnameParams(pathname, pathnameParams));
  }
}

export function testUrlPropsToHref() {
  const testData: Array<{description?: string; props: UrlProps; expected: string}> = [
    {
      description: 'href as model',
      props: {
        href: 'http://127.0.0.1/url-prefix/user/:id/:prop?type=model',
        pathnameParams: {
          id: 1,
          prop: 'age',
        },
        query: {
          from: 1,
          to: true,
          suffix: ['a', 1],
        },
      },
      expected: 'http://127.0.0.1/url-prefix/user/1/age?type=model&from=1&to=true&suffix=a&suffix=1',
    },
    {
      description: 'origin as model',
      props: {
        origin: 'http://127.0.0.1/url-prefix?suffix=2',
        pathname: '/user/:id/:prop',
        pathnameParams: {
          id: 1,
          prop: 'age',
        },
        query: {
          from: 1,
          to: true,
          suffix: ['a', 1],
        },
      },
      expected: 'http://127.0.0.1/url-prefix/user/1/age?suffix=2&suffix=a&suffix=1&from=1&to=true',
    },
    {
      description: 'pathname as path model',
      props: {
        pathname: '/api/debug/:action',
        pathnameParams: {
          action: 'echo',
        },
        query: {
          ts: 123,
        },
      },
      expected: '/api/debug/echo?ts=123',
    },
    {
      description: 'url as href',
      props: {
        url: 'http://elif.site/api/debug/:action',
        pathnameParams: {
          action: 'echo',
        },
        query: {
          ts: 123,
        },
      },
      expected: 'http://elif.site/api/debug/echo?ts=123',
    },
    {
      description: 'url as pathname model',
      props: {
        url: '/api/debug/:action',
        pathnameParams: {
          action: 'echo',
        },
        query: {
          ts: 123,
        },
      },
      expected: '/api/debug/echo?ts=123',
    },
    {
      props: {
        pathname: '/user/:id/:prop',
        pathnameParams: {
          id: 1,
          prop: 'age',
        },
        query: {
          from: 1,
          to: true,
          suffix: ['a', 1],
        },
      },
      expected: '/user/1/age?from=1&to=true&suffix=a&suffix=1',
    },
    {
      description: 'contain pathname prefix in origin',
      props: {
        origin: 'http://127.0.0.1/url-prefix',
        pathname: '/user/:id/:prop',
        pathnameParams: {
          id: 1,
          prop: 'age',
        },
        query: {
          from: 1,
          to: true,
          suffix: ['a', 1],
        },
      },
      expected: 'http://127.0.0.1/url-prefix/user/1/age?from=1&to=true&suffix=a&suffix=1',
    },
  ];
  for (const it of testData) {
    const {description, props, expected} = it;
    console.log(`run case: ${description}`);
    assert.equal(expected, urlPropsToHref(props));
  }
}

export async function testUrlPropsFromConfig() {
  const requestConfig = {
    origin: undefined,
    url: '/v1.0/ai-alerts/sensitivity?mode=app',
    method: 'GET',
    headers: {
      'sec-fetch-site': 'same-origin',
      'sec-ch-ua-platform': '"macOS"',
      'trace-id': '00000000000000000000000000000000',
      connection: 'close',
      origin: 'https://pulse-gcp.qe2.conviva.com',
    },
    href: 'https://instant-filter-server-gcp.qe2.conviva.com/v1.0/ai-alerts/sensitivity?mode=app',
  };
  const {urlProps} = getUrlPropsFromConfig(requestConfig);
  const href = urlPropsToHref(urlProps);
  assert.equal(href, requestConfig.href);
}

export async function testIsSameUrlTarget() {
  const href = 'http://elif.site/api/debug/echo?delay=3&show=true&p1=3&p1=5';
  const standard = {
    origin: 'http://elif.site',
    pathname: '/api/debug/echo',
    query: {
      delay: 3,
      show: true,
      p1: [3, 5],
    },
  };
  runFuncTestCases(isSameUrlTarget, [
    {
      params: [href, standard],
      expected: true,
    },
  ]);
}
