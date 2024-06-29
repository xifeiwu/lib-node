import fs from 'fs';
import path from 'path';
import {FormFile, NodeFormData, formDataToBuffer} from './form-data';
import {requestAndGetResponseInfo} from './client';
import {sendHttpRequestThroughTcp} from '../net';

export async function showContentOfFormData() {
  const formData: NodeFormData = {
    a: 1,
    file1: new FormFile(path.resolve(__dirname, 'form-data.ts')),
  };
  // const writer = fs.createReadStream(path.resolve(__dirname, 'form-data.ts'));
  // formData.append('form-data.ts', writer);
  const {headers, reader} = await formDataToBuffer(formData, {chunkedTransfer: false});
  // console.log(headers);
  // console.log(reader.toString());
  return {headers, reader};
}

export async function sendFormDataByHttp() {
  const {headers, reader} = await showContentOfFormData();
  const responseInfo = await requestAndGetResponseInfo({
    origin: 'http://127.0.0.1:3300',
    method: 'post',
    headers,
    data: reader,
  });
  console.log(responseInfo);
}
export async function sendFormDataToEchoByHttp() {
  const {headers, reader} = await showContentOfFormData();
  const responseInfo = await requestAndGetResponseInfo({
    origin: 'http://127.0.0.1:3180',
    pathname: '/api/debug/echo',
    method: 'post',
    headers,
    data: reader,
  });
  console.log(responseInfo);
}

export async function sendFormDataByTcp() {
  const {headers, reader} = await showContentOfFormData();
  const {data: responseInfo, socket} = await sendHttpRequestThroughTcp({
    origin: 'http://127.0.0.1:3300',
    method: 'post',
    headers: {
      ...headers,
      Host: '127.0.0.1:3300',
      Connection: 'close',
    },
    data: reader,
  }, {
    allowHalfOpen: true,
  });
  console.log(responseInfo);
  console.log(socket.readyState);
  setInterval(() => {}, 1000);
}
