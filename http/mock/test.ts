import path from 'path';
import {requestAndSaveMockInfo} from './generate';
import {RequestConfig} from './types';

export async function test() {
  const requestConfig: RequestConfig = {
    method: 'get',
    url: '/api/debug/echo',
  };
  await requestAndSaveMockInfo(requestConfig, {
    mockFileDir: path.resolve(__dirname, 'files'),
    basrUrl: 'http://elif.site',
  });
}
