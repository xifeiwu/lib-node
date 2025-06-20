import {DuplexOptions, ReadableOptions} from 'stream';

import {LogColors, BufferGeneratorConfig} from '../../../../types';

interface CommonFuncConfig {
  /** log what pushed or not */
  color?: LogColors;
  maxPrintSize?: number;
  /** time dealy during each push in ms */
  delay?: number;
}

export interface ReadFuncConfig extends BufferGeneratorConfig, CommonFuncConfig {}

export interface CustomizedReadableConfig extends ReadFuncConfig {
  readableOptions?: ReadableOptions;
}

export interface WriteFuncConfig extends CommonFuncConfig {}

export interface CustomizedDuplexConfig extends DuplexOptions {
  readFuncConfig?: ReadFuncConfig;
  writeFuncConfig?: WriteFuncConfig;
}
