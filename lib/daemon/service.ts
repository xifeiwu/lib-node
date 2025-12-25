import {TcpServerInfo} from './external';
import {CpInfo, ResponseError, SerializableCpInfo} from './types';

export const MAX_WAIT_TIME_DEBUG_MODE = 120;

export function serializeCpInfo(cpInfo: CpInfo): SerializableCpInfo {
  const {childProcess, ...rest} = cpInfo;
  return {
    pid: childProcess?.pid,
    ...rest,
  };
}

export function getErrorResponse(err: Error | string): ResponseError {
  let message = err as string;
  if (err instanceof Error) {
    message = err.stack ? err.stack : err.message;
  }
  const errorResponse: ResponseError = {
    type: 'error',
    data: message,
  };
  return errorResponse;
}
export function serializeSocketServerInfo(info: TcpServerInfo) {
  const {path, host, port} = info;
  if (path) {
    return {path};
  } else {
    return {host, port};
  }
}
