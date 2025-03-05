import assert from 'assert';
import {Readable} from 'stream';
import {tryParseHttpFirstLine, tryParseHttpHeaderPart} from './parse-header-part';
import {getDataFromReadable} from '../../../index';
import {HttpRequestInfo} from '../../../types';
import {httpRequestInfoToBuffer} from '../../service';

const requestInfo: HttpRequestInfo = {
  method: 'post',
  url: '/api/debug/echo',
  httpVersion: 'HTTP/1.1',
  headers: {
    from: 'test',
    'content-length': '13',
  },
  data: {
    a: 1,
    b: 2,
  },
};
export async function testParseHttpHeaderPart() {
  const reader = new Readable({
    read() {
      this.push(httpRequestInfoToBuffer(requestInfo));
      this.push(null);
    },
  });
  const {headerPartProps, dataConsumed} = await tryParseHttpHeaderPart(reader);
  assert.deepEqual(headerPartProps, {
    method: 'POST',
    url: '/api/debug/echo',
    httpVersion: 'HTTP/1.1',
    headers: {from: 'test', 'content-length': '13'},
  });
  assert.equal(
    dataConsumed.toString(),
    ['POST /api/debug/echo HTTP/1.1', 'from: test', 'content-length: 13', '', ''].join('\r\n')
  );
  const data = await getDataFromReadable(reader);
  assert.equal(data.toString(), '{"a":1,"b":2}');
}

export async function testParseHttpFirstLine() {
  const reader = new Readable({
    read() {
      this.push(httpRequestInfoToBuffer(requestInfo));
      this.push(null);
    },
  });
  try {
    const {firstLineInfo, dataConsumed: dataConsumed4FirstLine} = await tryParseHttpFirstLine(reader);
    console.log(`firstLineInfo`);
    assert.deepEqual(firstLineInfo, {
      method: 'POST',
      url: '/api/debug/echo',
      httpVersion: 'HTTP/1.1',
    });
    assert.equal(dataConsumed4FirstLine.toString(), `POST /api/debug/echo HTTP/1.1\r\n`);
    const {headerPartProps: requestInfo, dataConsumed} = await tryParseHttpHeaderPart(reader, firstLineInfo);

    assert.deepEqual(requestInfo, {
      method: 'POST',
      url: '/api/debug/echo',
      httpVersion: 'HTTP/1.1',
      headers: {from: 'test', 'content-length': '13'},
    });
    assert.equal(dataConsumed.toString(), ['from: test', 'content-length: 13', '', ''].join('\r\n'));
    const data = await getDataFromReadable(reader);
    assert.equal(data.toString(), '{"a":1,"b":2}');
  } catch (err) {
    console.log(err);
  }
}
