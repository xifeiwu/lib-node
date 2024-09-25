import fs from 'fs';
import net from 'net';
import path from 'path';
import {InfoToCp, SerializableSpawnInfo, SpawnAndTryIpcResponse} from '../../types';
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
  serializeSpawnResponse,
  waitParentMessageFromIPC,
  startSocketClient,
} from '../../index';
import {DaemonSocketDir} from '../daemon/service';
import {isString} from 'markdown-it/lib/common/utils';
import {Socket} from 'net';

const daemonConfig: InfoToCp<CP.DaemonConfig> = {config: {}};
let socketInfo: CP.DaemonSocketInfo;
const cpStatus: CP.DaemonCPStatus = {
  status: 'none',
  currentAction: 'none',
  retryCount: 0,
};
// let exitSignal: Promise<boolean>;
let exitSignal: {
  resolve?: () => void;
  reject?: (err: Error) => void;
} = {};

// cpInfoHistory: SpawnAndTryIpcResponse[];
// cpInfoHistory: [],

function getDaemonInfo(): CP.DaemonInfo {
  const {response, ...rest} = cpStatus;
  return {
    pid: process.pid,
    config: daemonConfig,
    socketPath: socketInfo.path,
    cpStatus: {
      ...rest,
      response: serializeSpawnResponse(response),
    },
  };
}

async function onExit() {
  // if (cpInfo.status === 'onExit') {
  //   throw new Error(`Already in status: ${cpInfo.status}`);
  // }
  const {response, currentAction} = cpStatus;
  cpStatus.status = 'exit';
  const {config: {retry = {}} = {}} = daemonConfig;
  const {spawnTime} = response ?? {};
  // const {status, nextAction} = cpInfo.status;
  const {minInterval, maxCount} = retry;
  let delay = 0;
  if (isNumber(minInterval)) {
    delay = minInterval - (Date.now() - new Date(spawnTime).getTime());
  }
  function letChildDie() {
    cpStatus.status = 'none';
    if (exitSignal.resolve) {
      exitSignal.resolve();
    }
  }
  async function restartChild() {
    await new Promise(res => {
      process.nextTick(res);
    });
    await trySpawn();
    cpStatus.retryCount++;
  }
  if (currentAction === 'stop' || currentAction === 'restart') {
    letChildDie();
  } else if (currentAction === 'start') {
    if (isNumber(maxCount) && cpStatus.retryCount < maxCount) {
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
  const {spawnConfig} = daemonConfig;
  /** Not throw erro when spawn child process and spawnConfig is null */
  if (!spawnConfig) {
    // throw new Error(`Please provide spawnConfig`);
    return null;
  }
  // Only can start new cp when cp status is not equal 'none'
  if (cpStatus.status !== 'none') {
    throw new Error(`We can't start child process in this status: ${cpStatus.status}`);
  }
  const cpInfo = await spawnAndTryIpc(spawnConfig);
  const {childProcess} = cpInfo;
  childProcess.once('exit', code => {
    onExit();
  });
  return cpInfo;
}

async function start() {
  const cpInfo = await trySpawn();
  if (cpInfo) {
    cpStatus.status = 'running';
    cpStatus.response = cpInfo;
    cpStatus.currentAction = 'start';
    cpStatus.retryCount = 0;
  }
}

async function stop() {
  if (cpStatus.status !== 'running') {
    throw new Error(`Child process is not running, it's in status is: ${cpStatus.status}`);
  }
  const {response} = cpStatus;
  if (!response) {
    throw new Error(`cpInfo is null`);
  }
  const {childProcess} = response;
  if (!childProcess) {
    throw new Error(`childProcess is null`);
  }
  await killProcessByPid([childProcess.pid]);
  /** change status after killProcessByPid success */
  cpStatus.status = 'stop';
  cpStatus.currentAction = 'stop';
  await waitExitComplete();
}

async function restart() {
  cpStatus.currentAction = 'restart';
  if (cpStatus.status === 'running') {
    await stop();
  }
  await start();
}

function checkPermissionBeforeCreateDir(dirname: string) {
  if (dirname.startsWith(process.env.HOME)) {
    makeSureDirExist(dirname);
  } else {
    throw new Error(`Don't have permission to create dir: ${dirname}`);
  }
}

async function handleIncomingMessage(chunk: Buffer): Promise<CP.DaemonResponseOnAction> {
  const obj = fromBuffer(chunk, 'json');
  if (isObject(obj)) {
    const {action, info: infoToCp} = obj as CP.DaemonAction;
    switch (action) {
      case 'stop':
        await stop();
        return {
          type: 'stop',
          data: getDaemonInfo(),
        };
      case 'start':
        await onInfo(infoToCp);
        await start();
        return {
          type: 'start',
          data: getDaemonInfo(),
        };
      case 'restart':
        await onInfo(infoToCp);
        await restart();
        return {
          type: 'restart',
          data: getDaemonInfo(),
        };
      case 'info':
        return {
          type: 'info',
          data: getDaemonInfo(),
        };
      case 'ping':
        // socket.write('pong');
        return {
          type: 'pong',
        };
    }
  } else {
    return {type: 'unknown', data: getDaemonInfo()};
  }
}

export async function checkDaemonSocketActivity(socketPath: string): Promise<boolean | null> {
  const closeInActive = true;
  if (!fs.existsSync(socketPath)) {
    return null;
  }
  let client: Socket;
  try {
    client = await startSocketClient(socketPath);
    return true;
  } catch (err) {
    closeInActive && fs.unlinkSync(socketPath);
    return false;
  } finally {
    client && client.end();
  }
}
function getSocketPath(socketPath?: CP.DaemonConfig['socketPath']) {
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
    if (socketPath.startsWith('/')) {
      const pathInfo = getFilePathInfo(socketPath);
      dirname = pathInfo.dirname;
      basename = pathInfo.basename;
    } else if (!socketPath.includes('/')) {
      basename = socketPath;
    } else {
      throw new Error(
        `socketPath in format of string can only be fullpath or basename only, basename should not contain character /`
      );
    }
  } else if (isObject(socketPath)) {
    dirname = socketPath.dirname;
    basename = socketPath.basename;
  }
  if (dirname === undefined) {
    dirname = DaemonSocketDir;
  }
  if (basename === undefined) {
    basename = process.pid + '.socket';
  }
  checkPermissionBeforeCreateDir(dirname);
  socketPath = path.join(dirname, basename);
  return socketPath;
}

function getErrorResponse(message: string): CP.DaemonResponseError {
  const errorResponse: CP.DaemonResponseError = {
    type: 'error',
    message,
  };
  return errorResponse;
}

async function startSocketServer(pathConfig?: CP.DaemonConfig['socketPath']) {
  const socketPath = getSocketPath(pathConfig);
  if (fs.existsSync(socketPath)) {
    const isActive = await checkDaemonSocketActivity(socketPath);
    if (isActive) {
      throw new Error(`socketPath is listened by an active socket server`);
    }
  }
  const server = net.createServer();
  server.listen(socketPath);
  server.on('connection', socket => {
    // try {
    //   /** return daemon info on connection */
    //   socket.write(toBuffer(getDaemonInfo()));
    // } catch (err) {
    //   socket.end(err.message);
    // }
    socket.on('data', async chunk => {
      try {
        const response = await handleIncomingMessage(chunk);
        if (response && socket.writable) {
          socket.end(toBuffer(response));
        }
      } catch (err) {
        socket.write(toBuffer(getErrorResponse(err.message)));
        out(err.message);
      }
    });
  });
  return new Promise<CP.DaemonSocketInfo>((res, rej) => {
    server.on('listening', () => {
      // out(response);
      res({path: socketPath, server});
    });
    server.on('error', err => {
      out(err.message);
      rej(err);
    });
  });
}

async function onInfo(info?: InfoToCp<CP.DaemonConfig>) {
  if (info === undefined) {
    return;
  }
  const {config = {}, spawnConfig} = info;
  if (spawnConfig !== undefined) {
    daemonConfig.spawnConfig = spawnConfig;
  }
  for (const key of Object.keys(config) as Array<keyof CP.DaemonConfig>) {
    if (key === 'socketPath') {
      const newSocketPath = getSocketPath(config.socketPath);
      /** restart a new socket server is socketPath is changed */
      if (socketInfo.path !== newSocketPath) {
        if (socketInfo.server) {
          try {
            socketInfo.server.close();
          } catch (err) {
            /** handle Error */
          }
        }
        socketInfo = await startSocketServer(config.socketPath);
      }
    } else {
      daemonConfig.config[key] = config[key];
    }
  }
}
/**
 * Start a socket server listening to a local file, and response server info on request.
 * @param args
 */
export async function main(args: any[]) {
  const ipcMessage: InfoToCp<CP.DaemonConfig> = await waitParentMessageFromIPC<CP.DaemonConfig>();
  socketInfo = await startSocketServer(ipcMessage?.config?.socketPath);
  const actionStart: CP.DaemonAction = {action: 'start', info: ipcMessage};
  const response = await handleIncomingMessage(toBuffer(actionStart));
  return response;
}

async function run() {
  try {
    const response = await main(process.argv);
    out(response);
  } catch (err) {
    out(getErrorResponse(err.message));
  }
}
run();
