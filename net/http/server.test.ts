import {Readable} from 'stream';
import {parseHttpFirstLine, parseHttpHeaderPart} from './server';
import {tcpRequestPropsToBuffer} from './client';

export async function testParseHttpHeaderPart() {
  const reader = new Readable({
    read() {
      this.push(
        tcpRequestPropsToBuffer({
          method: 'post',
          url: '/api/debug/echo',
          headers: {
            from: 'test',
          },
          data: {
            a: 1,
            b: 2,
          },
        })
      );
      this.push(null);
    },
  });
  const {requestInfo, dataConsumed} = await parseHttpHeaderPart(reader);
  console.log(`requestInfo`);
  console.log(requestInfo);
  console.log(`dataConsumed.toString()`);
  console.log(dataConsumed.toString());
  // reader.push(dataConsumed);
  reader.on('data', chunk => {
    console.log(`remaining data`);
    console.log(chunk.toString());
  });
}

export async function testParseHttpFirstLine() {
  const reader = new Readable({
    read() {
      this.push(
        tcpRequestPropsToBuffer({
          method: 'post',
          url: '/api/debug/echo',
          headers: {
            from: 'test',
          },
          data: {
            a: 1,
            b: 2,
          },
        })
      );
      this.push(null);
    },
  });
  try {
    const {firstLineInfo, dataConsumed: dataConsumed4FirstLine} = await parseHttpFirstLine(reader);
    console.log(`firstLineInfo`);
    console.log(firstLineInfo);
    console.log(`dataConsumed4FirstLine.toString()`);
    console.log(dataConsumed4FirstLine.toString());
    const {requestInfo, dataConsumed} = await parseHttpHeaderPart(reader, firstLineInfo);
    console.log(`requestInfo`);
    console.log(requestInfo);
    console.log(`dataConsumed.toString()`);
    console.log(dataConsumed.toString());
    reader.on('data', chunk => {
      console.log(`remaining data`);
      console.log(chunk.toString());
    });
  } catch (err) {
    console.log(err);
  }
}
