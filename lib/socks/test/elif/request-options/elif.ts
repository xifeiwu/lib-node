import {HttpRequestOptions} from '../../../service/external';

export const httpRequestOptions: HttpRequestOptions = {
  method: 'get',
  origin: 'https://elif.site/api/debug/echo',
  headers: {
    host: 'elif.site',
  },
  // origin: 'http://elif.site/api/debug/echo',
};
