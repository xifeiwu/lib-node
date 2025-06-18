import http from 'http';
import {ConnectionPayload, HttpResponseInfo} from '../../../types';
import {Readable} from 'stream';
import {convertToBuffer} from '../../../transform';
import {updateHeadersByHttpInfo} from '../../tcp';

export function sendHttpResponse<Payload extends ConnectionPayload = any>(
  response: http.ServerResponse,
  responseInfo: Partial<HttpResponseInfo<Payload>>
) {
  const {statusCode, statusMessage, headers = {}, data} = responseInfo;
  const {dataIsUndefined, dataIsReadable, headers: finalHeaders} = updateHeadersByHttpInfo({headers, data});
  for (const [key, value] of Object.entries({statusCode, statusMessage})) {
    if (value !== undefined) {
      response[key] = value;
    }
  }
  for (const [name, value] of Object.entries(finalHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        response.setHeader(name, item);
      }
    } else {
      response.setHeader(name, value);
    }
  }
  if (dataIsUndefined) {
    response.end();
  } else {
    if (dataIsReadable) {
      (data as Readable).pipe(response);
    } else {
      response.write(convertToBuffer(data));
    }
  }
  return response;
}
