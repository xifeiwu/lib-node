import {Readable} from 'stream';
import {tcpRequestPropsToBuffer, parseHttpFirstLine, parseHttpHeaderPart} from './http';
import {handleSocketEvents, startSocketClient} from './utils';

export async function testGetRequestData() {
  const socket = await startSocketClient({
    host: 'elif.site',
    port: 80,
  });
  handleSocketEvents(socket);
  socket.end(
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
}

export async function sendRequestDataByChunk() {
  const socket = await startSocketClient({
    host: 'elif.site',
    port: 80,
  });
  const total = tcpRequestPropsToBuffer({
    method: 'post',
    url: '/api/debug/echo',
    headers: {
      from: 'test',
    },
    data: {
      a: 1,
      b: 2,
    },
  });
  const index = 20;
  const firstPart = total.subarray(0, index);
  const remainingPart = total.subarray(index);
  handleSocketEvents(socket);
  socket.write(firstPart);
  socket.end(remainingPart);
}

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
