import {goOnOrNot} from '../../readline';
import {GetProcessInfoOptions, PidToProcessInfo, ProcessInfo} from '../../types';
import {treeInfoList} from './base';
import {getProcessInfo} from './info';

async function getProcessInfoMap(options?: GetProcessInfoOptions) {
  const {infoList: processList} = await getProcessInfo(options);
  return treeInfoList(processList);
}

function getChildPidList(info: ProcessInfo): number[] {
  const list: number[] = [];
  const {children} = info;
  // list.push(pid);
  if (Array.isArray(children)) {
    for (const child of children) {
      list.push(child.pid);
      list.push(...getChildPidList(child));
    }
  }
  return list;
}
/**
 *
 * @returns boolean, kill process success or not
 */
function killProcessAndItsChildren(info: ProcessInfo, options?: {killChildren: boolean}): boolean {
  const {killChildren = true} = options ?? {};
  const {pid, children} = info;
  try {
    process.kill(pid);
  } catch (err) {
    console.log(err);
    return false;
  }
  if (!killChildren || !Array.isArray(children)) {
    return true;
  }
  return children.every(child => killProcessAndItsChildren(child));
}

async function filterOutChildProcessOfPidList(
  pidList: Array<string | number>,
  pidToInfo: PidToProcessInfo
): Promise<Array<string | number>> {
  const pInfoList = pidList
    .map(pid => {
      const info = pidToInfo[pid];
      if (!info) {
        return null;
      }
      return info;
    })
    .filter(it => it !== null);
  const pidToChildPidList = pInfoList.reduce<{[key: string]: number[]}>((sum, it) => {
    const {pid} = it;
    return {
      ...sum,
      [pid]: getChildPidList(it),
    };
  }, {});
  const allChildPid = Object.values(pidToChildPidList).reduce<number[]>((sum, list) => {
    return [...sum, ...list];
  }, []);
  const pidToKill = pidList.filter(pid => !allChildPid.includes(Number(pid)));
  return pidToKill;
}

interface KillProcessByPidOptions extends KillProcessOptions {
  pidToInfo?: PidToProcessInfo;
  doubleConfirm?: boolean;
}

export async function killProcessByPid(
  pidList: Array<number | string>,
  options?: KillProcessByPidOptions
): Promise<boolean> {
  const {doubleConfirm, killChildren = true, pidToInfo: pidToInfoInOptions} = options ?? {};
  const pidToInfo = pidToInfoInOptions
    ? pidToInfoInOptions
    : await getProcessInfoMap({appendChildInfo: killChildren});
  pidList = killChildren ? await filterOutChildProcessOfPidList(pidList, pidToInfo) : pidList;
  const infoListToKill = pidList.map(pid => pidToInfo[pid]).filter(Boolean);
  if (infoListToKill.length === 0) {
    return false;
  }
  if (doubleConfirm) {
    const goOn = await goOnOrNot({
      tips: [
        {
          content: infoListToKill,
          style: {color: 'black'},
        },
        {
          content: 'Will kill the above process',
        },
      ],
      defaultValue: true,
    });
    if (!goOn) {
      return false;
    }
  }
  return infoListToKill.every(
    info => {
      return killProcessAndItsChildren(info, {
        killChildren,
      });
    },
    {killChildren}
  );
}

interface KillProcessOptions extends GetProcessInfoOptions {
  doubleConfirm?: boolean;
  killChildren?: boolean;
}
export async function killProcess(options: KillProcessOptions): Promise<ProcessInfo[]> {
  const {doubleConfirm, killChildren, ...getProcessOptions} = options ?? {};
  const {infoList, pidToInfo} = await getProcessInfo(getProcessOptions);
  if (
    killProcessByPid(
      infoList.map(it => it.pid),
      {pidToInfo, doubleConfirm, killChildren}
    )
  ) {
    return infoList;
  }
  return null;
}
