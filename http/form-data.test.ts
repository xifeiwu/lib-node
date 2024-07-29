import path from 'path';
import {FormFile, NodeFormData, formDataToBuffer} from './form-data';
import {requestAndGetResponseInfo} from './client';
import {sendHttpRequestByTcp, watchSocketState} from '../net';
import {getDataFromReadable} from '../stream';
import {startHttpDebugServer} from './server';

export async function getFormData() {
  const formData: NodeFormData = {
    a: 1,
    file1: new FormFile(path.resolve(__dirname, 'form-data.ts')),
  };
  const {headers, reader} = await formDataToBuffer(formData, {chunkedTransfer: false});
  // console.log(headers);
  // console.log(reader.toString());
  return {headers, reader};
}

export async function sendFormDataByHttp() {
  const {origin} = await startHttpDebugServer();
  const {headers, reader} = await getFormData();
  const responseInfo = await requestAndGetResponseInfo({
    // origin: 'http://127.0.0.1:3180',
    origin,
    pathname: '/api/debug/echo',
    method: 'post',
    headers,
    data: reader,
  });
  console.log(responseInfo);
}

export async function sendFormDataByTcp() {
  const {origin} = await startHttpDebugServer();
  const {headers, reader} = await getFormData();
  const client = await sendHttpRequestByTcp(
    {
      // origin: 'http://127.0.0.1:3180',
      origin,
      method: 'post',
      pathname: '/api/debug/echo',
      headers: {
        ...headers,
        Host: '127.0.0.1:3180',
        Connection: 'close',
      },
      data: reader,
    },
    {
      allowHalfOpen: true,
    }
  );
  watchSocketState(client, {color: 'cyan'});
  const resData = await getDataFromReadable(client);
  console.log(resData.toString());
}
