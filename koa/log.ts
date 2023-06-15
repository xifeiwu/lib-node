import Koa from 'koa';

export default function (options: {prefix?: string; maxRequestDataLength?: number}) {
  const {prefix = '->', maxRequestDataLength = 3000} = options;
  return async (ctx: Koa.Context, next: Koa.Next) => {
    const {method = null, href, type, headers, req} = ctx;
    console.log(`${prefix} ${href}`);
    new Promise<Buffer>((res, rej) => {
      const bufferList: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        if (bufferList.length < maxRequestDataLength) {
          bufferList.push(chunk);
        }
      });
      req.on('end', function () {
        res(Buffer.concat(bufferList));
      });
      req.on('error', (err: any) => {
        rej(err);
      });
    })
      .then(buf => {
        console.log(`HTTP ${method} ${href}`);
        console.log(headers);
        if (type === 'application/json') {
          console.log(buf.toString());
        }
      })
      .catch(err => {
        console.log(err);
      });
    await next();
  };
}
