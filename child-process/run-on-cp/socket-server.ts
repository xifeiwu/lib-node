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
  toSpawnRelatedInfo,
  waitParentMessageFromIPC,
} from '../../index';
import {socketDir} from '../daemon/service';
import {isString} from 'markdown-it/lib/common/utils';
import {Socket} from 'net';

let spawnConfig: SpawnAndTryIpcConfig;
let cpInfo: SpawnAndTryIpcResponse;
let cpStatus: 'none' | 'start' | 'running' | 'stop' | 'exit' = 'none';
let currentAction: 'none' | 'start' | 'stop' | 'restart' = 'none';
let retryCount = 0;
// let exitSignal: Promise<boolean>;
let exitSignal: {
  resolve?: () => void;
  reject?: (err: Error) => void;
} = {};

// cpInfoHistory: SpawnAndTryIpcResponse[];
// cpInfoHistory: [],

const daemonStatus: CP.DaemonStatus = {};

function getDaemonInfo() {
  
}

async function onExit() {
  // if (cpStatus === 'onExit') {
  //   throw new Error(`Already in status: ${cpStatus}`);
  // }
  cpStatus = 'exit';
  const {config: {retry = {}} = {}} = daemonStatus;
  const {spawnTime} = cpInfo ?? {};
  // const {status, nextAction} = cpStatus;
  const {minInterval, maxCount} = retry;
  let delay = 0;
  if (isNumber(minInterval)) {
    delay = minInterval - (Date.now() - new Date(spawnTime).getTime());
  }
  function letChildDie() {
    cpStatus = 'none';
    if (exitSignal.resolve) {
      exitSignal.resolve();
    }
  }
  async function restartChild() {
    await new Promise(res => {
      process.nextTick(res);
    });
    await trySpawn();
    retryCount++;
  }
  if (currentAction === 'stop' || currentAction === 'restart') {
    letChildDie();
  } else if (currentAction === 'start') {
    if (isNumber(maxCount) && retryCount < maxCount) {
      if (delay > 0) {
        setTimeout(restartChild, delay);
      } else {
        restartChild();
      }
    } else {
      letChildDie();
    }
  } else {
    letChildDie();
  }
}

async function waitExitComplete() {
  return new Promise<void>((res, rej) => {
    exitSignal.resolve = res;
    exitSignal.reject = rej;
  });
}

async function trySpawn() {
  // Only can start new cp when cp status is not equal 'none'
  if (cpStatus !== 'none') {
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
}

async function start() {
  const cpInfo = await trySpawn();
  currentAction = 'start';
  retryCount = 0;
  return cpInfo;
}

async function stop() {
  if (cpStatus !== 'running') {
    throw new Error(`Can only stop child process when it's in status: running`);
  }
  if (!cpInfo) {
    throw new Error(`cpInfo is null`);
  }
  const {childProcess} = cpInfo;
  if (!childProcess) {
    throw new Error(`childProcess is null`);
  }
  cpStatus = 'stop';
  currentAction = 'stop';
  await killProcessByPid([childProcess.pid]);
  await waitExitComplete();
}

async function restart() {
  currentAction = 'restart';
  if (cpStatus === 'running') {
    await stop();
  }
  return await start();
}

function checkPermissionBeforeCreateDir(dirname: string) {
  if (dirname.startsWith(process.env.HOME)) {
    makeSureDirExist(dirname);
  } else {
    throw new Error(`Don't have permission to create dir: ${dirname}`);
  }
}

type Action = {
  action: 'start' | 'stop' | 'restart' | 'ping';
  // daemonConfig: CP.DaemonConfig;
  infoToCp: InfoToCp<CP.DaemonConfig>;
};
async function handleSocketData(chunk: Buffer, socket: Socket) {
  const obj = fromBuffer(chunk, 'json');
  if (isObject(obj)) {
    const {action, infoToCp} = obj as Action;
    switch (action) {
      case 'stop':
        await stop();
        break;
      case 'start':
        await onInfo(infoToCp);
        await start();
        break;
      case 'restart':
        await onInfo(infoToCp);
        await restart();
        break;
      case 'ping':
        socket.write('pong');
        break;
    }
  } else {
    socket.write(toBuffer({daemonStatus, cpInfo: toSpawnRelatedInfo(cpInfo)}));
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
    try {
      // socket.writable && socket.write(toBuffer(response));
      socket.on('data', chunk => {
        const data = fromBuffer(chunk, 'json') as {action: 'ping'};
        if (data?.action === 'ping') {
          socket.writable && socket.write(toBuffer('pong'));
        }
      });
    } catch (err) {
      socket.end(err.message);
    }
  });
  return new Promise<Pick<CP.DaemonStatus, 'socketPath' | 'socketServer'>>((res, rej) => {
    server.on('listening', () => {
      // out(response);
      res({socketPath, socketServer: server});
    });
    server.on('error', err => {
      out(err.message);
      rej(err);
    });
  });
}

async function onInfo(info?: InfoToCp<CP.DaemonConfig>) {
  const {config = {}} = info;
  daemonStatus.pid = process.pid;
  daemonStatus.config = config;
  spawnConfig = info.spawnConfig;
  if (daemonStatus.socketPath !== config.socketPath) {
    if (daemonStatus.socketServer) {
      try {
        daemonStatus.socketServer.close();
      } catch (err) {
        /** handle Error */
      }
    }
    const {socketPath} = await startSocketServer(config.socketPath);
    daemonStatus.socketPath = socketPath;
  }
}
/**
 * Start a socket server listening to a local file, and response server info on request.
 * @param args
 */
export async function main(args: any[]) {
  const ipcMessage: InfoToCp<CP.DaemonConfig> = await waitParentMessageFromIPC<CP.DaemonConfig>();
  await onInfo(ipcMessage);
  // const {config = {}} = ipcMessage;
  // daemonStatus.pid = process.pid;
  // daemonStatus.config = config;
  // spawnConfig = ipcMessage.spawnConfig;
  // const {socketPath} = await startSocketServer(config.socketPath);
  // daemonStatus.socketPath = socketPath;
}

async function run() {
  try {
    main(process.argv);
  } catch (err) {
    out(err.message);
  }
}
run();
