import fs from 'fs';
import path from 'path';
import {spawn, execSync, SpawnOptionsWithoutStdio} from 'child_process';
import {findClosestFile} from './path';
import {selectOption} from './common';
import {isBoolean, isString} from './fe';

type Prop = 'pid' | 'ppid' | 'pgid' | 'sess' | 'rss' | 'args';
type ProcessInfo = {
  [key in Prop]: string;
};

interface Options {
  filter?: (info: Partial<ProcessInfo>) => boolean;
  printCommand?: boolean;
}
export async function getAllProcessInfo(options?: Options) {
  const {filter, printCommand} = options ? options : ({} as Options);
  let processLister;
  // const props = ['pid', 'ppid', 'pgid', 'sess', 'rss', 'vsz', 'pcpu', 'args', 'user', 'time'];
  const props: Prop[] = ['pid', 'ppid', 'pgid', 'sess', 'rss', 'args'];
  if (process.platform === 'win32') {
    // win32 is not supported
    return [];
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

  return new Promise<ProcessInfo[]>((resolve, reject) => {
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
            sum[it] = items.slice(index).join(' ');
          } else {
            sum[it] = items[index];
          }
          return sum;
        }, {} as ProcessInfo);
      });

      resolve(
        processList.filter(process => {
          if (!filter) {
            return true;
          }
          return filter(process);
        })
      );
    });
  });
}

/**
 * Find the process who use the port, and kill it.
 * @param options
 * @returns The info of process killed
 */
export async function killByPort(
  port: number | string,
  options: {
    printProcessInfo?: boolean;
    selectProcessToKill?: boolean;
  }
) {
  const {printProcessInfo, selectProcessToKill} = options;
  /**
   * > lsof -i:3005
   * COMMAND   PID    USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
   * node    72770 wuxifei   21u  IPv6 0x2464db0cd5195045      0t0  TCP *:geniuslm (LISTEN)
   */
  const output = execSync(`lsof -i:${port}`).toString();
  const lines: string[][] = output
    .split('\n')
    .slice(1)
    .map(line => {
      return line.split(/ +/);
    });
  const pidReg = /^[\d]+$/;
  const pidList = lines
    .map(it => {
      if (!Array.isArray(it)) {
        return false;
      }
      const [, pid] = it;
      if (pidReg.test(pid)) {
        return pid;
      } else {
        return null;
      }
    })
    .filter(it => it);
  if (pidList.length === 0) {
    throw new Error(`length of pid list is zero`);
  }
  const processInfoList = await getAllProcessInfo({
    filter: it => {
      return pidList.includes(it.pid);
    },
  });
  printProcessInfo && console.log(processInfoList);
  const pidToKill: string[] = [];
  if (processInfoList.length > 1) {
    if (selectProcessToKill) {
      const selected = await selectOption(
        [
          {
            label: 'kill all',
            pid: '-1',
          },
          ...processInfoList.map(it => {
            const {pid, ppid, args} = it;
            return {
              pid,
              ppid,
              args,
              label: `${pid}.${ppid} - ${args}`,
            };
          }),
        ],
        {
          defaultIndex: 0,
        }
      );
      if (selected.pid === '-1') {
        pidToKill.push(...processInfoList.map(it => it.pid));
      } else {
        pidToKill.push(selected.pid);
      }
    } else {
      pidToKill.push(...processInfoList.map(it => it.pid));
    }
  } else if (processInfoList.length > 0) {
    pidToKill.push(processInfoList[0].pid);
  }

  pidToKill.forEach(pid => process.kill(Number(pid)));
  return pidToKill.map(pid => processInfoList.find(it => it.pid === pid));
}

/** Existing key with a null value means should give a default value by program */
interface TsNodeOptions {
  '-r'?: string | null;
  '--project'?: string | null;
  '--transpileOnly'?: boolean;
}

export interface SpawnTsFileOptions {
  tsNodeOptions?: TsNodeOptions;
  printCommand?: boolean;
  params?: string[];
  spawnOptions?: Parameters<typeof spawn>[2];
}
const defaultSpwanTsFileOptions: SpawnTsFileOptions = {
  printCommand: false,
  params: [],
  spawnOptions: {},
};
const defaultTsNodeOptions: TsNodeOptions = {
  '-r': null,
  '--project': null,
};
export function spawnTsFile(execPath: string, options?: SpawnTsFileOptions) {
  const fullExecPath = execPath.startsWith('/') ? execPath : path.resolve(process.cwd(), execPath);
  if (!fs.existsSync(fullExecPath)) {
    throw new Error(`path not exist: ${fullExecPath}`);
  }
  const mergedOptions = {...defaultSpwanTsFileOptions, ...options};
  const {tsNodeOptions = {}, printCommand, params, spawnOptions} = mergedOptions;
  const mergedTsNodeOptions = {...defaultTsNodeOptions, ...tsNodeOptions};

  const dirPath = path.dirname(fullExecPath);
  if (Object.prototype.hasOwnProperty.call(mergedTsNodeOptions, '-r') && mergedTsNodeOptions['-r'] === null) {
    let tsConfigPathsRegister = findClosestFile(dirPath, 'node_modules/tsconfig-paths/register.js');
    if (!tsConfigPathsRegister) {
      const {NVM_BIN} = process.env;
      if (NVM_BIN) {
        const tsConfigPathsRegister = path.resolve(NVM_BIN, '../lib/node_modules/tsconfig-paths/register.js');
      }
    }
    if (fs.existsSync(tsConfigPathsRegister)) {
      mergedTsNodeOptions['-r'] = tsConfigPathsRegister;
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(mergedTsNodeOptions, '--project') &&
    mergedTsNodeOptions['--project'] === null
  ) {
    mergedTsNodeOptions['--project'] = findClosestFile(dirPath, 'tsconfig.json');
  }

  const tsNodeParams: string[] = [];
  Object.entries(mergedTsNodeOptions).forEach(([key, value]) => {
    if (!value) {
      return;
    }
    if (isString(value)) {
      tsNodeParams.push(key, value as string);
    } else if (isBoolean(value)) {
      tsNodeParams.push(key);
    }
  });
  const fileExecParams = [fullExecPath, ...params];
  const allParams = [...tsNodeParams, ...fileExecParams];
  const childProcess = spawn('ts-node', allParams, {
    stdio: ['pipe', 'pipe', 'pipe'],
    ...spawnOptions,
  });
  if (printCommand) {
    console.log(`spawn command: ts-node ${allParams.join(' ')}`);
  }
  return childProcess;
}
