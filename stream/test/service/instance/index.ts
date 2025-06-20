import {Duplex, DuplexOptions, Readable} from 'stream';
import {CustomizedDuplexConfig, CustomizedReadableConfig, ReadFuncConfig, WriteFuncConfig} from './types';
import {getReadFunc, getWriteFunc} from './service';

/**
 * configurable reader
 */
export function getCustomizedReader(config?: CustomizedReadableConfig) {
  const {readableOptions = {}, ...restConfig} = config ?? {};
  const d1 = new Readable({
    read: getReadFunc(restConfig),
    ...readableOptions,
  });
  return d1;
}

export function getCustomizedDuplex(config?: CustomizedDuplexConfig) {
  const {readFuncConfig, writeFuncConfig, ...duplexOptions} = config ?? {};
  const duplex = new Duplex({
    read: getReadFunc(readFuncConfig),
    write: getWriteFunc(writeFuncConfig),
    ...duplexOptions,
  });
  return duplex;
}
