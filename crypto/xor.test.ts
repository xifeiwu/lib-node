import {Duplex, pipeline} from 'stream';
import {getIv, xorData, getXorTransform} from './xor';
import {logColorful, toBuffer} from '..';

export async function testXor() {
  const iv = getIv(3);
  const data = '初始数据';
  const decrypted = xorData(data, iv);
  logColorful({}, decrypted);
  const enctypted = xorData(decrypted, iv);
  logColorful({}, enctypted);
}

function getClientAndServer() {
  const iv = getIv(3);
  const client = new Duplex({
    read() {},
    write(chunk) {
      logColorful({}, 'client consume data:', chunk);
    },
  });
  client.push('data from client');
  const server = new Duplex({
    read() {},
    write(chunk) {
      const data = xorData(chunk, iv);
      const response = toBuffer(['response from buffer:', data]);
      logColorful({}, 'server consume data:', data);
      server.push(xorData(response, iv));
    },
  });
  return {client, server, iv};
}
export function pipeDirectly() {
  const {client, server, iv} = getClientAndServer();
  pipeline(client, server, err => {
    console.log(err);
  });
  pipeline(server, client, err => {
    console.log(err);
  });
}

export async function xorBetweenStream() {
  const {client, server, iv} = getClientAndServer();
  pipeline(client, getXorTransform(iv), server, err => {
    console.log(err);
  });
  pipeline(server, getXorTransform(iv), client, err => {
    console.log(err);
  });
}

export async function wrapClientByTwoTransform() {
  const {client, server, iv} = getClientAndServer();
  const clientReader = getXorTransform(iv);
  client.pipe(clientReader);
  const clientWriter = getXorTransform(iv);
  clientWriter.pipe(client);
  pipeline(clientReader, server, err => {
    console.log(err);
  });
  pipeline(server, clientWriter, err => {
    console.log(err);
  });
}

export async function wrapClientByOneDuplex() {
  const {client, server, iv} = getClientAndServer();
  const clientWrapper = new Duplex({
    read() {},
    write(chunk) {
      client.write(xorData(chunk, iv));
    },
  });
  client.on('data', chunk => {
    clientWrapper.push(xorData(chunk, iv));
  });
  pipeline(clientWrapper, server, err => {
    console.log(err);
  });
  pipeline(server, clientWrapper, err => {
    console.log(err);
  });
}
