import {spawn, execSync} from 'child_process';
import {goOnOrNot, selectOption} from '../general';
import {isFunction, isNumber} from '../external';
import {checkPort} from '../net';
import {
  ProcessInfo,
  ProcessProps,
  ProcessFilter,
  ProcessInfoFilterFunc,
  GetProcessInfoOptions,
  PidToProcessInfo,
} from '../types';

export function getFilterFunc(filter?: ProcessFilter): ProcessInfoFilterFunc | null {
  if (!filter) {
    return null;
  }
  if (isFunction(filter)) {
    return filter as ProcessInfoFilterFunc;
  }
  const filterFunc: ProcessInfoFilterFunc = (current: ProcessInfo) => {
    return Object.entries(filter).every(([key, value]) => {
      if (value === undefined) {
        return true;
      }
      if ('command' === key) {
        return current[key].includes(value as string);
      } else if (isNumber(current[key])) {
        /** If type current value is number, convert target value to number */
        return Number(value) === Number(current[key]);
      }
      return value === current[key];
    });
  };
  return filterFunc;
}

function treeInfoList(infoList: ProcessInfo[]) {
  return infoList.reduce<PidToProcessInfo>((sum, it) => {
    const {pid} = it;
    return {
      ...sum,
      [pid]: it,
    };
  }, {});
}
/**
 * Will change on origin object, should run only once
 * @param infoList
 * @returns
 */
function toAppendChildInfo(infoList: ProcessInfo[]) {
  const pidToInfo = treeInfoList(infoList);
  for (const info of infoList) {
    const {ppid} = info;
    const pInfo = pidToInfo[ppid];
    if (!pInfo) {
      // parent id 0 not found
      // throw new Error(`parent id ${ppid} not found`);
      continue;
    }
    if (!Array.isArray(pInfo.children)) {
      pInfo.children = [];
    }
    if (pInfo.children.every(it => it.pid !== info.pid)) {
      pInfo.children.push(info);
    }
  }
  return {pidToInfo};
}

interface ProcessRelatedInfo {
  infoList: ProcessInfo[];
  pidToInfo?: PidToProcessInfo;
  allInfoList: ProcessInfo[];
}
export async function getProcessInfo(options?: GetProcessInfoOptions): Promise<ProcessRelatedInfo> {
  const {printCommand, filter, appendChildInfo = true} = options ?? {};
  const filterFunc = getFilterFunc(filter);
  let processLister;
  // const props = ['pid', 'ppid', 'pgid', 'sess', 'rss', 'vsz', 'pcpu', 'args', 'user', 'time'];
  const propsWithNumberType: ProcessProps[] = ['pid', 'ppid', 'pgid', 'cpu', 'rss', 'vsize'];
  const propsWithStringtype: ProcessProps[] = ['etime', 'command'];
  const props: ProcessProps[] = [...propsWithNumberType, ...propsWithStringtype];
  if (process.platform === 'win32') {
    // win32 is not supported
    return null;
    // See also: https://github.com/nodejs/node-v0.x-archive/issues/2318
    // processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
  } else {
    // ps -A -o 'pid,ppid,rss,vsz,pcpu,command,user,time'
    // pid:       process ID
    // ppid:      parent process ID
    // rss:       resident set size, 实际内存占用大小(单位killobytes)
    // vsz:       virtual size in Kbytes (alias vsize), 虚拟内存占用大小
    // pcup:      percentage CPU usage (alias pcpu)
    // command:   command and arguments
    // time:      user + system
    printCommand && console.log('ps', ['-A', '-o', props.join(',')].join(' '));
    processLister = spawn('ps', ['-A', '-o', props.join(',')]);
  }

  function assignValue(info: ProcessInfo, key, value) {
    if (propsWithNumberType.includes(key)) {
      info[key] = Number(value);
    } else {
      info[key] = value;
    }
  }
  return new Promise<ProcessRelatedInfo>((resolve, reject) => {
    const bufList = [];
    processLister.stdout.on('data', data => {
      bufList.push(data);
    });

    processLister.stderr.on('data', data => {
      console.log(`stderr: ${data}`);
      reject(data);
    });

    /** Not sure it is better to on 'exit' or 'close' */
    processLister.on('close', code => {
      const data = Buffer.concat(bufList).toString();
      const threads = data.toString().split('\n');
      const processList = threads.slice(1).map(it => {
        const items = it.trim().split(/\s+/);
        return props.reduce<ProcessInfo>((sum, it, index) => {
          if (index == props.length - 1) {
            assignValue(sum, it, items.slice(index).join(' '));
          } else {
            assignValue(sum, it, items[index]);
          }
          return sum;
        }, {} as ProcessInfo);
      });

      let pidToProcessInfo: PidToProcessInfo;
      if (appendChildInfo) {
        const {pidToInfo} = toAppendChildInfo(processList);
        pidToProcessInfo = pidToInfo;
      }
      const result: ProcessRelatedInfo = {
        allInfoList: processList,
        infoList: filterFunc ? processList.filter(filterFunc) : processList,
        pidToInfo: pidToProcessInfo,
      };
      resolve(result);
    });
  });
}

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
// function isChildProcess(ppid, pid) {
//   if ([ppid, pid].includes(undefined) || ppid === pid) {
//     return false;
//   }
//   const pInfo = infoTree[ppid];
//   if (!pInfo) {
//     return false;
//   }
//   const {children} = pInfo;
//   if (!Array.isArray(children)) {
//     return false;
//   }
//   return children.some(child => {
//     if (child.pid === pid) {
//       return true;
//     }
//     return isChildProcess(child.pid, pid);
//   });
// }
/**
 * Remove pid in pidList when it is child process of another pid in pidList
 * @param pidList
 * @param infoList
 */

/**
 *
 * @returns boolean, kill process success or not
 */
function killProcessAndItsCp(info: ProcessInfo, options?: {killChildren: boolean}): boolean {
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
  return children.every(child => killProcessAndItsCp(child));
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
      return killProcessAndItsCp(info, {
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

export async function getProcessInfoByPort(port: number | string): Promise<ProcessInfo[]> {
  /**
   * > lsof -i:3005
   * COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
   * node    72770 wuxifei   21u  IPv6 0x2464db0cd5195045      0t0  TCP *:geniuslm (LISTEN)
   */
  try {
    const output = execSync(`lsof -i:${port}`).toString();
    const lines: string[][] = output
      .split('\n')
      .slice(1)
      .map(line => {
        return line.split(/ +/);
      });
    const pidReg = /^[\d]+$/;
    const pidList: string[] = lines
      .map(it => {
        if (!Array.isArray(it)) {
          return null;
        }
        const [, pid] = it;
        if (pidReg.test(pid)) {
          return pid;
        } else {
          return null;
        }
      })
      .filter(it => Boolean(it));
    if (pidList.length === 0) {
      return [];
    }
    const {infoList} = await getProcessInfo({
      filter: it => {
        return pidList.includes(String(it.pid));
      },
    });
    return infoList;
  } catch {
    return [];
  }
}

/**
 * Find the process who use the port, and kill it.
 * @param options
 * @returns The info of process killed
 */
// export async function selectProcessToKill(
//   processInfoList: ProcessInfo[],
//   options?: {
//     printProcessInfo?: boolean;
//     selectProcessToKill?: boolean;
//   }
// ) {
//   const {printProcessInfo, selectProcessToKill} = options ?? {};
//   printProcessInfo && console.log(processInfoList);
//   const pidToKill: number[] = [];
//   if (processInfoList.length > 1) {
//     if (selectProcessToKill) {
//       const selected = await selectOption(
//         [
//           {
//             label: 'kill all',
//             pid: -1,
//           },
//           ...processInfoList.map(it => {
//             const {pid, ppid, command} = it;
//             return {
//               pid,
//               ppid,
//               command,
//               label: `${pid}.${ppid} - ${command}`,
//             };
//           }),
//         ],
//         {
//           defaultIndex: 0,
//         }
//       );
//       if (selected.pid === -1) {
//         pidToKill.push(...processInfoList.map(it => it.pid));
//       } else {
//         pidToKill.push(selected.pid);
//       }
//     } else {
//       pidToKill.push(...processInfoList.map(it => it.pid));
//     }
//   } else if (processInfoList.length > 0) {
//     pidToKill.push(processInfoList[0].pid);
//   }

//   pidToKill.forEach(pid => process.kill(Number(pid)));
//   return pidToKill.map(pid => processInfoList.find(it => it.pid === pid));
// }

export async function closePortIfInUse(port: number) {
  const isPortOpen = await checkPort(port);
  if (isPortOpen) {
    const processInfoList = await getProcessInfoByPort(port);
    return killProcessByPid(
      processInfoList.map(it => it.pid),
      {doubleConfirm: true}
    );
  }
  return [];
}
