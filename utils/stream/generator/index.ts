import {Duplex, Readable, Transform, Writable} from 'stream';
import {
  CustomizedDuplexConfig,
  CustomizedReadableConfig,
  CustomizedTransformConfig,
  CustomizedWritableConfig,
} from './types';
import {getReadFunc, getWritableFuncs} from './service';

export type * from './types';

/**
 * configurable reader
 */
export function getCustomizedReader(config?: CustomizedReadableConfig) {
  const {readableOptions = {}, ...restConfig} = config ?? {};
  const reader = new Readable({
    read: getReadFunc(restConfig),
    ...readableOptions,
  });
  return reader;
}

export function getCustomizedWriter(config?: CustomizedWritableConfig) {
  const {writableOptions, ...restConfig} = config ?? {};
  return new Writable({
    ...getWritableFuncs(restConfig),
    ...writableOptions,
  });
}

export function getCustomizedDuplex(config?: CustomizedDuplexConfig) {
  const {customize: {read, write, ...common} = {}, ...duplexOptions} = config ?? {};
  const duplex = new Duplex({
    read: read ? getReadFunc({...read, ...common}) : () => {},
    ...(write ? getWritableFuncs({...write, ...common}) : {}),
    ...duplexOptions,
  });
  return duplex;
}

export function getCustomizedTransform(config?: CustomizedTransformConfig) {
  const {customize: {read, write, ...common} = {}, ...transformOptions} = config ?? {};
  const transform = new Transform({
    read: read ? getReadFunc({...read, ...common}) : () => {},
    ...(write ? getWritableFuncs({...write, ...common}) : {}),
    ...transformOptions,
  });
  return transform;
}
