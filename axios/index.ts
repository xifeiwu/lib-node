import http from 'http';
import {logWithColor} from '../log';
import {AxiosError} from 'axios';

export function prettyConsoleAxiosError(err: AxiosError | Error) {
  if (!(err as AxiosError).isAxiosError) {
    return;
  }
  const {config, message, code, stack, request, response} = err as AxiosError;
  logWithColor('red', message, code);
  const {data} = config;
  if (request) {
    const {method, protocol, host, path} = request as http.ClientRequest;
    logWithColor('black', `${method.toUpperCase()}  ${protocol}${host}${path}`, request.getHeaders(), data);
  }
  if (response) {
    const {status, statusText, headers, data} = response;
    logWithColor('black', `${status} ${statusText}`, headers, data as any);
  }
}
