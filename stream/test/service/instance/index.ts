import {Duplex, Readable, Transform, TransformOptions} from 'stream';
import {CustomizedDuplexConfig, CustomizedReadableConfig, CustomizedTransformConfig} from './types';
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
  const {customize: {read, write, ...common} = {}, ...duplexOptions} = config ?? {};

  const duplex = new Duplex({
    read: read ? getReadFunc({...read, ...common}) : undefined,
    write: write ? getWriteFunc({...write, ...common}) : undefined,
    ...duplexOptions,
  });
  return duplex;
}

export function getCustomizedTransform(config?: CustomizedTransformConfig) {
  const {customize: {read, write, ...common} = {}, ...otherOptions} = config ?? {};
  const transformOptions: TransformOptions = {
    ...otherOptions,
  };
  if (read) {
    transformOptions.read = getReadFunc({...read, ...common});
  }
  if (write) {
    transformOptions.write = getWriteFunc({...write, ...common});
  }
  const transform = new Transform(transformOptions);
  return transform;
}
