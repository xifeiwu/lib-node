import {spawn, execSync} from 'child_process';
import {isFunction, isNumber} from '../../external';
import {
  ProcessInfo,
  ProcessProps,
  ProcessFilter,
  ProcessInfoFilterFunc,
  GetProcessInfoOptions,
  PidToProcessInfo,
} from '../../types';
import {treeInfoList} from './base';

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

export function getProcessInfoByInst(p: NodeJS.Process): ProcessInfo {
  const {pid, ppid} = process;
  const info: ProcessInfo = {
    pid,
    ppid,
    pgid: process.getgid(),
    etime: process.uptime() + '',

    rss: process.memoryUsage.rss(),
    cpu: 0,
    vsize: 0,
    command: process.argv.join(' '),
  };
  return info;
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
