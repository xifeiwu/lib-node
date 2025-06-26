import {Duplex, Readable, Transform, TransformOptions, Writable} from 'stream';
import {
  CustomizedDuplexConfig,
  CustomizedReadableConfig,
  CustomizedTransformConfig,
  CustomizedWritableConfig,
} from './types';
import {getReadFunc, getWritableFuncs} from './service';

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

export function getCustomizedWriter(config?: CustomizedWritableConfig) {
  const {writableOptions, ...restConfig} = config ?? {};
  return new Writable({
    ...getWritableFuncs(restConfig),
    // final(cb) {
    //   if (restConfig.color) {
    //     logColorful({color: restConfig.color}, 'final of writer is called');
    //   }
    //   cb && cb();
    // },
    ...writableOptions,
  });
}

export function getCustomizedDuplex(config?: CustomizedDuplexConfig) {
  const {customize: {read, write = {}, ...common} = {}, ...duplexOptions} = config ?? {};
  // duplex read, write function can't be undefined
  const duplex = new Duplex({
    read: read ? getReadFunc({...read, ...common}) : () => {},
    ...(write ? getWritableFuncs({...write, ...common}) : {}),
    ...duplexOptions,
  });
  return duplex;
}

export function getCustomizedTransform(config?: CustomizedTransformConfig) {
  const {customize: {read, write, ...common} = {}, ...transformOptions} = config ?? {};
  // duplex read, write function can't be undefined
  const transform = new Transform({
    read: read ? getReadFunc({...read, ...common}) : () => {},
    ...(write ? getWritableFuncs({...write, ...common}) : {}),
    ...transformOptions,
  });
  return transform;
}
