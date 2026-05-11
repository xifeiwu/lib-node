import {HttpRequestOptions} from '../../../service/external';

export const httpRequestOptions: HttpRequestOptions = {
  method: 'get',
  href: 'https://elif.site/api/debug/echo',
  // origin: 'http://elif.site/api/debug/echo',
  headers: {
    host: 'elif.site',
  },
};
