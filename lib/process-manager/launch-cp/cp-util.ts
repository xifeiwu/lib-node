import {waitIpcMessageOnce} from '../service/external';
import type {InfoToCp} from '../service';

export function waitInfoFromParent(config?: {maxWaitInSec?: number}) {
  return waitIpcMessageOnce<InfoToCp>(config);
}
