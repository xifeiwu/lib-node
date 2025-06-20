import {ColorStyle} from '../../../../types';

export interface WatchStreamOptions {
  colorStyle?: ColorStyle;
  logPrefix?: string;
  /**
   * if maxPrintSizeOnData is not undefined,
   * will listen on 'data' event, and print maxPrintSizeOnData bytes data if is a number
   */
  maxPrintSizeOnData?: number;
  /**
   * print stream state
   */
  printState?: boolean;
}
