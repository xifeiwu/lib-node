import {DuplexOptions, ReadableOptions, TransformOptions, WritableOptions} from 'stream';

import {LogColors, BufferGeneratorConfig} from '../../../../types';

interface CommonFuncConfig {
  /** log what pushed or not */
  color?: LogColors;
  /** prefix before log content */
  logPrefix?: string;
  maxPrintSize?: number;
  /** time dealy during each push in ms */
  delay?: number;
}

export interface ReadFuncConfig extends BufferGeneratorConfig, CommonFuncConfig {}

export interface CustomizedReadableConfig extends ReadFuncConfig {
  readableOptions?: ReadableOptions;
}

export interface WriteFuncConfig extends CommonFuncConfig {}

export interface CustomizedWritableConfig extends WriteFuncConfig {
  writableOptions?: WritableOptions;
}

interface DuplexFuncConfig extends CommonFuncConfig {
  read?: ReadFuncConfig;
  write?: WriteFuncConfig;
}
export interface CustomizedDuplexConfig extends DuplexOptions {
  customize?: DuplexFuncConfig;
}

export interface CustomizedTransformConfig extends TransformOptions {
  customize?: DuplexFuncConfig;
}
