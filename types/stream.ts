export type ReadableEvent = 'data' | 'readable' | 'pause' | 'resume' | 'end' | 'error' | 'close';

export interface WriterSpeedInfo {
  bytesPerSecond: number;
  speedWord: string;
}

export interface SpeedCalOptions {
  maxSampleingCount?: number;
  minIntervalSize?: number;
}

/**
 * These values should be set depends on writability of the writer:
 * 1. if the writability is weak, maxSize should be small to avoid long time waiting
 * 2. if the writability is fast, it's better not do console action in intervalCb
 *    to avoid time consuming that not caused by action of write
 */
export interface GetWritabilityOptions extends SpeedCalOptions {
  maxSize?: number | string;
  intervalCb?: (results: WriterSpeedInfo) => void;
}

export interface ParsedInfoWithDataConsumed<T> {
  info?: T;
  dataConsumed: Buffer;
}
