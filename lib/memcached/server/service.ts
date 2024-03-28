import {ErrorMessage, ErrorStatus} from '../types';

export function getError(errorType: ErrorStatus, message: string = ''): ErrorMessage {
  return `${errorType} ${message}`;
}
