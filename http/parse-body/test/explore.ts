import path from 'path';
import {parseBody} from '..';
import {startHttpServer} from '../../server';
import {startSocketClient} from '../../../net';
import {toBuffer} from '../service/external';

export async function funcTest() {
  const {origin, host, port, server} = await startHttpServer({
    request: async (request, response) => {
      try {
        const data = await parseBody(request, {
          uploadDir: path.resolve(__dirname, 'uploads'),
        });
        response.statusCode = 200;
        response.end(toBuffer(data));
      } catch (err) {
        console.log(err);
        const {writable, destroyed} = response;
        if (writable) {
          response.statusCode = 500;
          const content = err?.message ? err.message : 'unknown server error';
          response.end(content);
        }
      }
    },
  });
  const client = await startSocketClient({host, port, allowHalfOpen: true});
  const data = `POST /api/debug/echo?dataType=parsed HTTP/1.1
cookie:OUTFOX_SEARCH_USER_ID_NCOO=1233668436.6809294
accept-language:zh-CN,zh;q=0.9
accept-encoding:gzip, deflate, br
referer:http://localhost:8201/axios/form-data
origin:http://localhost:8201
user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36
content-type:multipart/form-data; boundary=----WebKitFormBoundaryE7DpP5ncpQWn8RRu
accept:application/json, text/plain, */*
connection:close
host:127.0.0.1:3100
content-length:433

------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="name"

xfwu
------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="level"

senior
------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="send-http-request.ts"; filename="send-http-request.ts"
Content-Type: text/javascript

fs.readFileSync(__filename)
------WebKitFormBoundaryE7DpP5ncpQWn8RRu--`.replace(/\n/g, '\r\n');
  client.on('data', chunk => {
    console.log(chunk.toString());
  });
  client.on('end', chunk => {
    console.log(`Client End`);
  });
  client.on('error', err => {
    console.log(`Error catched on Client:`);
    console.log(err);
  });
  client.write(toBuffer(data));
  // client.end(toBuffer(data));
}

export async function clientRequest() {
  const host = '127.0.0.1';
  const port = 3300;
  const client = await startSocketClient({host, port, allowHalfOpen: true});
  const data = `POST /api/debug/echo?dataType=parsed HTTP/1.1
cookie:OUTFOX_SEARCH_USER_ID_NCOO=1233668436.6809294
accept-language:zh-CN,zh;q=0.9
accept-encoding:gzip, deflate, br
referer:http://localhost:8201/axios/form-data
origin:http://localhost:8201
user-agent:Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36
content-type:multipart/form-data; boundary=----WebKitFormBoundaryE7DpP5ncpQWn8RRu
accept:application/json, text/plain, */*
connection:close
host:127.0.0.1:3100
content-length:430

------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="name"

1
------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="level"

senior
------WebKitFormBoundaryE7DpP5ncpQWn8RRu
Content-Disposition: form-data; name="send-http-request.ts"; filename="send-http-request.ts"
Content-Type: text/javascript

fs.readFileSync(__filename)
------WebKitFormBoundaryE7DpP5ncpQWn8RRu--
`.replace(/\n/g, '\r\n');
  client.on('data', chunk => {
    console.log(chunk.toString());
  });
  client.on('end', chunk => {
    console.log(`Client End`);
  });
  client.on('error', err => {
    console.log(`Error catched on Client:`);
    console.log(err);
  });
  client.write(toBuffer(data));
  setInterval(() => {}, 1000);
}
