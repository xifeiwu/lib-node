import {ReadableOptions} from 'stream';
import {logColorful} from '../../log';
import {BufferGeneratorConfig} from '../../types';

export interface DataGeneratorConfig extends BufferGeneratorConfig {
  /** log what pushed or not */
  color?: Parameters<typeof logColorful>[0]['color'];
  maxPrintSize?: number;
  /** time dealy during each push */
  delay?: number;
}

export interface CustomizedReadableConfig extends DataGeneratorConfig {
  readableOptions?: ReadableOptions;
}
