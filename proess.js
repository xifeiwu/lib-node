/**
  process是一个全局变量，可以直接调用。
  process的属性，如下：
  version：包含当前node实例的版本号；
  installPrefix：包含安装路径；
  platform：列举node运行的操作系统的环境，只会显示内核相关的信息，如：linux2， darwin，而不是“Redhat ES3” ，“Windows 7”，“OSX 10.7”等；
  pid：获取进程id；
  title：设置进程名称；
  execPath：当前node进程的执行路径，如：/usr/local/bin/node；
  memoryUsage()：node进程内存的使用情况，rss代表ram的使用情况，vsize代表总内存的使用大小，包括ram和swap；
  heapTotal,process.heapUsed：分别代表v8引擎内存分配和正在使用的大小。
  argv：这是一个数组，数组里存放着启动这个node.js进程各个参数和命令代码；
  uptime()：包含当前进程运行的时长（秒）；
  getgid()：获取或者设置group id；
  setuid()：获取或者设计user id；
  cwd()：当前工作目录；
  exit(code=0)：kill当前进程；
  kill(pid, signal='SIGTERM')：发出一个kill信号给指定pid；
  nextTick(callback)：异步执行callback函数；
  umask([mask]) ：设置进程的user mask值；
  */
export function getProcessInfo(p) {
  const results = {};
  [
    'version', // 包含当前node实例的版本号；
    'release', // 返回与当前发布相关的元数据对象
    'platform', // 列举node运行的操作系统的环境，只会显示内核相关的信息，如：linux2， darwin，而不是“Redhat ES3” ，“Windows 7”，“OSX 10.7”等；
    'arch', // 返回一个表示操作系统CPU架构的字符串，Node.js二进制文件是为这些架构编译的。 例如 'arm', 'arm64', 'x32', 或 'x64'
    'pid', // 获取进程id
    'ppid', // 获取父进程id
    'title', // 设置进程名称
    'execPath', // 当前node进程的执行路径，如：/usr/local/bin/node
    'arch',
  ].forEach(key => {
    results[key] = p[key];
  });
  ['memoryUsage', 'cwd'].forEach(key => {
    results[key] = p[key]();
  });
  return results;
}

// get stream returned by command
export function spawnCmdPS() {
  var processLister;
  const props = ['pid', 'ppid', 'rss', 'vsz', 'pcpu', 'user', 'time', 'command'];
  if (process.platform === 'win32') {
    // win32 is not supported
    return [];
    // See also: https://github.com/nodejs/node-v0.x-archive/issues/2318
    // processLister = spawn('wmic.exe', ['PROCESS', 'GET', 'Name,ProcessId,ParentProcessId,Status']);
  } else {
    // ps -A -o 'pid,ppid,rss,vsz,pcpu,user,time,command'
    // pid:       process ID
    // ppid:      parent process ID
    // rss:       resident set size, 实际内存占用大小(单位killobytes)
    // vsz:       virtual size in Kbytes (alias vsize), 虚拟内存占用大小
    // pcup:      percentage CPU usage (alias pcpu)
    // command:   command and arguments
    // time:      user + system
    processLister = childProcess.spawn('ps', ['-A', '-o', props.join(',')]);
  }
  return processLister;
}
// 获取所有进程的基本信息
export async function getThreadsInfoAll() {
  const props = ['pid', 'ppid', 'rss', 'vsz', 'pcpu', 'user', 'time', 'command'];
  const processLister = this.spawnCmdPS();
  return new Promise((resolve, reject) => {
    const bufList = [];
    processLister.stdout.on('data', data => {
      bufList.push(data);
    });

    processLister.stderr.on('data', data => {
      console.log(`stderr: ${data}`);
      reject(data);
    });

    processLister.on('close', code => {
      const data = Buffer.concat(bufList).toString();
      const threads = data.toString().split('\n');
      const threadsList = threads.slice(1).map(it => {
        const items = it.trim().split(/\s+/);
        const result = {};
        props.forEach((it, index) => {
          if (index == props.length - 1) {
            result[it] = items.slice(index).join(' ');
          } else {
            result[it] = items[index];
          }
        });
        return result;
      });
      // console.log(threadsList);
      resolve(threadsList);
    });
  });
}

// kill pid and its childpid
export async function killByPid(pid, killTree = true) {
  const threadsInfo = await this.getThreadsInfoAll();
  const mainThread = threadsInfo.find(it => it.pid == pid);
  if (!mainThread) {
    return Promise.reject(`no thread with pid ${pid}`);
  }
  const pidKilled = [];
  const kill = thread => {
    pidKilled.push(thread.pid);
    process.kill(thread.pid, 'SIGTERM');
  };
  const traverseFind = thread => {
    if (!thread.hasOwnProperty('children')) {
      var children = threadsInfo.filter(it => it.ppid == thread.pid);
      if (children.length > 0) {
        thread.children = children;
        children.forEach(traverseFind);
      }
    }
  };
  const traverseKill = thread => {
    if (thread.hasOwnProperty('children')) {
      thread.children.forEach(traverseKill);
      delete thread.children;
      traverseKill(thread);
    } else {
      kill(thread);
    }
  };
  if (killTree) {
    traverseFind(mainThread);
    traverseKill(mainThread);
  } else {
    kill(mainThread);
  }
  return pidKilled;
}

// 通过pid获取线程基本信息
export async function getThreadInfoByPid(pid) {
  const threadsInfoList = await this.getThreadsInfoAll();
  return threadsInfoList.find(it => it.pid == pid);
}
