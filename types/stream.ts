import { ColorStyle } from "..";

export type ReadableEvent = 'data' | 'readable' | 'pause' | 'resume' | 'end' | 'error' | 'close';

export interface WatchStreamOptions {
  colorStyle?: ColorStyle;
  logPrefix?: string;
  /** will listen on 'data' event, and print maxPrintSizeOnData bytes data if is a number */
  maxPrintSizeOnData?: number;
}
