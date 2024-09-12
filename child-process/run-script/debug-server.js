const net = require('net');
const http = require('http');

async function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    try {
      const socket = net.createConnection({host, port});
      socket.setTimeout(800);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        // console.log('timeout');
        socket.destroy();
        resolve(false);
      });
      socket.on('error', err => {
        // console.log(`${port} error`);
        resolve(false);
      });
    } catch (err) {
      resolve(false);
    }
  });
}
async function getAFreePort(startPort) {
  const host = '127.0.0.1';
  const endPort = 10000;
  let port = startPort !== undefined ? startPort : 3000;
  while (port < endPort) {
    const isOpen = await checkPort(port, host);
    if (!isOpen) {
      return port;
    }
    port++;
  }
  throw new Error('not free port found');
}
async function getDataFromReadable(reader) {
  return new Promise((resolve, reject) => {
    const bufferList = [];
    reader.on('data', chunk => {
      bufferList.push(chunk);
    });
    reader.on('end', () => {
      resolve(Buffer.concat(bufferList));
    });
    reader.on('error', err => {
      reject(err);
    });
  });
}

function out(value) {
  console.log(value);
  process.send && process.send(value);
}

async function start() {
  let ipcMessage = {};
  if (process.send) {
    ipcMessage = await new Promise(res => {
      process.once('message', chunk => {
        res(chunk);
      });
      /** Wait message for one second at most */
      setTimeout(() => {
        res({});
      }, 1000);
    });
  }
  const {config: {port: port2, customization} = {}} = ipcMessage;

  const host = '127.0.0.1';
  port = await getAFreePort(port2);
  const origin = `http://${host}:${port}`;
  const server = http.createServer().listen(port, host);
  server.on('request', async (request, response) => {
    const {method, url, httpVersion, headers} = request;
    console.log(url);
    const reqData = (await getDataFromReadable(request)).toString();
    const resData = Buffer.from(JSON.stringify({method, url, httpVersion, headers, reqData}));
    response.setHeader['content-length'] = resData.byteLength;
    response.setHeader['content-type'] = 'application/json';
    response.end(resData);
  });
  try {
    await new Promise((res, rej) => {
      server.on('listening', () => {
        res();
      });
      server.on('error', err => rej(err));
    });
    const info = {origin, host, port};
    out(info);
  } catch (err) {
    out(err.message);
  }
}

start();
