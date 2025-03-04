import {Writable} from 'stream';
import {byteToWord, throttle, wordToByte} from '../../external';
import {WriterSpeedInfo, SpeedCalOptions, GetWritabilityOptions} from '../../types';

export function getSpeedCal(options?: SpeedCalOptions) {
  const {maxSampleingCount = 60, minIntervalSize = 1} = options ?? {};
  let firstTime: number;
  let totalSize = 0;
  const sizeList: {size: number; timestamp: number}[] = [];
  function pushSample(size: number) {
    if (firstTime === undefined) {
      firstTime = Date.now();
    }
    if (sizeList.length > maxSampleingCount) {
      sizeList.shift();
    }
    sizeList.push({size, timestamp: Date.now()});
    totalSize += size;
  }
  function calSpeedPerSecond(size: number, msDuration: number) {
    const bytesPerSecond = (size * 1000) / msDuration;
    const speedWord = `${byteToWord(bytesPerSecond)}/s`;
    return {bytesPerSecond, speedWord};
  }
  function calIntervalSpeed() {
    if (sizeList.length > minIntervalSize) {
      const first = sizeList[0];
      const last = sizeList[sizeList.length - 1];
      const durition = last.timestamp - first.timestamp;
      const total = sizeList.reduce<number>((sum, it) => {
        return sum + it.size;
      }, 0);
      return calSpeedPerSecond(total, durition);
    }
    return null;
  }
  function calTotalSpeed() {
    return calSpeedPerSecond(totalSize, Date.now() - firstTime);
  }
  function dataSentSize() {
    return totalSize;
  }
  return {pushSample, calIntervalSpeed, dataSentSize, calTotalSpeed};
}

export async function writeability(
  writer: Writable,
  options?: GetWritabilityOptions
): Promise<WriterSpeedInfo> {
  const {intervalCb} = options ?? {};
  const maxSize = wordToByte(options?.maxSize ?? '1g');
  const chunkSize = 64 * 1024;

  const {pushSample, calIntervalSpeed, calTotalSpeed, dataSentSize} = getSpeedCal(options);

  const callIntervalSppedCb = throttle(
    () => {
      const speedInfo = calIntervalSpeed();
      if (speedInfo && intervalCb) {
        intervalCb(speedInfo);
      }
    },
    1000,
    false
  );
  async function writeUntilFull() {
    while (dataSentSize() < maxSize) {
      const success = writer.write(Buffer.alloc(chunkSize));
      pushSample(chunkSize);
      if (!success) {
        break;
      }
    }
    if (dataSentSize() >= maxSize) {
      writer.end();
    }
    callIntervalSppedCb();
  }
  writeUntilFull();
  writer.on('drain', writeUntilFull);

  return new Promise(res => {
    writer.on('finish', () => {
      res(calTotalSpeed());
    });
  });
}
