import {checkPort} from '../net';
import {getProcessInfoByPort, killProcessByPid} from './service';
export async function closePortIfInUse(port: number, options?: {doubleConfirm?: boolean}) {
  const {doubleConfirm} = options ?? {};
  const isPortOpen = await checkPort(port);
  if (isPortOpen) {
    const processInfoList = await getProcessInfoByPort(port);
    return killProcessByPid(
      processInfoList.map(it => it.pid),
      {doubleConfirm, killChildren: true}
    );
  }
  return [];
}
