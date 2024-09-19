import fs from 'fs';
import net from 'net';
import path from 'path';
import {InfoToCp, SpawnAndTryIpcConfig, SpawnAndTryIpcResponse} from '../../types';
import {out} from './service';
import {CP} from '../../types';
import {
  fromBuffer,
  getFilePathInfo,
  getSocketInfo,
  isNumber,
  isObject,
  killProcessByPid,
  makeSureDirExist,
  spawnAndTryIpc,
  toBuffer,
  waitParentMessageFromIPC,
} from '../../index';
import {socketDir} from '../daemon/service';
import {isString} from 'markdown-it/lib/common/utils';

let spawnConfig: SpawnAndTryIpcConfig;
let cpInfo: SpawnAndTryIpcResponse;
let cpStatus: 'idle' | 'start' | 'running' | 'stop' | 'onExit' | 'restarting' | 'die' = 'idle';
let actionOnExit: 'none' | 'restart' | 'stop' = 'none';
let retryCount = 0;

// cpInfoHistory: SpawnAndTryIpcResponse[];
// cpInfoHistory: [],

const daemonStatus: CP.DaemonStatus = {};

async function onExit() {
  if (cpStatus === 'onExit') {
    throw new Error(`Already in status: ${cpStatus}`);
  }
  cpStatus = 'onExit';
  const {config: {retry = {}} = {}} = daemonStatus;
  const {spawnTime} = cpInfo ?? {};
  // const {status, nextAction} = cpStatus;
  const {minUptime, maxCount} = retry;
  let delay = 0;
  if (isNumber(minUptime)) {
    delay = minUptime - (Date.now() - new Date(spawnTime).getTime());
  }
  function letChildDie() {
    cpInfo = null;
    cpStatus = 'die';
    actionOnExit = 'none';
  }
  async function restartChild() {
    cpStatus = 'idle';
    actionOnExit = 'none';
    await new Promise(res => {
      process.nextTick(res);
    });
    await start();
    retryCount++;
  }
  if (actionOnExit === 'restart' || (isNumber(maxCount) && retryCount < maxCount)) {
    if (delay > 0) {
      setTimeout(restartChild, delay);
    } else {
      restartChild();
    }
  } else {
    letChildDie();
  }
}
async function start() {
  if (cpInfo) {
    throw new Error(`Already running on process: ${cpInfo?.childProcess?.pid}`);
  }
  if (cpStatus !== 'idle') {
    throw new Error(`We can't start child process in this status: ${cpStatus}`);
  }
  if (!spawnConfig) {
    throw new Error(`Please provide spawnConfig`);
  }
  cpInfo = await spawnAndTryIpc(spawnConfig);
  cpStatus = 'running';
  const {childProcess} = cpInfo;
  childProcess.once('exit', code => {
    onExit();
  });
  return cpInfo;
  // daemonStatus.running = true;
  // daemonStatus.cpInfoList.push(cpInfo);
}
async function stop() {
  if (cpStatus === 'stop') {
    throw new Error(`Already in status: ${cpStatus}`);
  }
  if (!cpInfo) {
    throw new Error(`cpInfo is null`);
  }
  const {childProcess} = cpInfo;
  if (!childProcess) {
    throw new Error(`childProcess is null`);
  }
  cpStatus = 'stop';
  actionOnExit = 'stop';
  await killProcessByPid([childProcess.pid]);
}

async function restart() {
  if (cpStatus === 'running') {
    await stop();
  }
  retryCount = 0;
}
function checkPermissionBeforeCreateDir(dirname: string) {
  if (dirname.startsWith(process.env.HOME)) {
    makeSureDirExist(dirname);
  } else {
    throw new Error(`Don't have permission to create dir: ${dirname}`);
  }
}

async function startSocketServer(socketPath: CP.DaemonConfig['socketPath']) {
  /** use argument if ipcMessage is not passed */
  if (socketPath === undefined && Array.isArray(process.argv)) {
    const args = process.argv.slice(2);
    // args = Array.isArray(args) ? args.slice(2) : [];
    /** find the param starts with '/' as full path of socket file */
    socketPath = args.find(it => it.startsWith('/'));
  }
  let dirname: string;
  let basename: string;
  if (isString(socketPath)) {
    const pathInfo = getFilePathInfo(socketPath);
    dirname = pathInfo.dirname;
    basename = pathInfo.basename;
  } else if (isObject(socketPath)) {
    dirname = socketPath.dirname;
    basename = socketPath.basename;
  }
  if (dirname === undefined) {
    dirname = socketDir;
  }
  if (basename === undefined) {
    basename = process.pid + '.socket';
  }
  checkPermissionBeforeCreateDir(dirname);
  socketPath = path.join(dirname, basename);
  if (fs.existsSync(socketPath)) {
    throw new Error(`socketPath already exist, can not reuse an exsiting file`);
  }
  const server = net.createServer();
  server.listen(socketPath);
  server.on('connection', socket => {
    socket.writable && socket.write(toBuffer(response));
    socket.on('data', chunk => {
      const data = fromBuffer(chunk, 'json') as {action: 'ping'};
      if (data?.action === 'ping') {
        socket.writable && socket.write(toBuffer('pong'));
      }
    });
  });
  // process.on('beforeExit', () => {
  //   console.log('beforeExit cp')
  //   server.close();
  // });
  return new Promise<{socketPath: string}>((res, rej) => {
    server.on('listening', () => {
      // out(response);
      res({socketPath});
    });
    server.on('error', err => {
      out(err.message);
      rej(err);
    });
  });
}
/**
 * Start a socket server listening to a local file, and response server info on request.
 * @param args
 */
export async function main(args: any[]) {
  const ipcMessage: InfoToCp<CP.DaemonConfig> = await waitParentMessageFromIPC<CP.DaemonConfig>();
  const {config = {}} = ipcMessage;
  daemonStatus.pid = process.pid;
  daemonStatus.config = config;
  spawnConfig = ipcMessage.spawnConfig;
  const {socketPath} = await startSocketServer(config.socketPath);
  daemonStatus.socketPath = socketPath;
}

async function run() {
  try {
    main(process.argv);
  } catch (err) {
    out(err.message);
  }
}
run();
