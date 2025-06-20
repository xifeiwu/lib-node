import {ColorStyle, LogColors} from '../../../../types';

export interface WatchStreamOptions {
  color?: LogColors;
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
  isDuplex?: boolean;
}
