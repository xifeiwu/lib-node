import {Readable} from 'stream';
import net from 'net';
import fs from 'fs';
import {killProcessByPid, spawnAndTryIpc, isNumber, waitFor, get, makeSureDirExist} from './external';
import {
  serializeCpInfo,
  getCpDir,
  getLogSocketPath,
  getLogOutFilePath,
  getLogErrorFilePath,
  savePidInfo,
} from './service';
import {
  CpWrapperStatus,
  CpInfo,
  CpWrapperConfig,
  CpWrapperInfo,
  LogMode,
  PidInfoRecord,
  ResponseLog,
} from './types';
import {SpawnConfig} from './external';

const statusConvertRule: Partial<{
  [status in CpWrapperStatus['status']]: Array<CpWrapperStatus['status']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};
function canChangeToStatus(to: CpWrapperStatus['status'], from: CpWrapperStatus['status']) {
  return !statusConvertRule[to] || statusConvertRule[to].includes(from);
}
/**
 * Manager for one process,
 */
export class CpWrapper {
  config: CpWrapperConfig;
  status: CpWrapperStatus['status'];
  lastAction: CpWrapperStatus['lastAction'];
  retryCount: CpWrapperStatus['retryCount'];
  cpInfo?: CpInfo;
  exitSignal: {
    resolve?: () => void;
    reject?: (err: Error) => void;
  } = {};
  logBuffer: string[] = [];
  private stdoutPartial = '';
  private stderrPartial = '';
  isOrphan = false;
  orphanPid?: number;
  private logSocketServer?: net.Server;
  private logSocketPath?: string;
  private logSocketClients: Set<net.Socket> = new Set();
  private logOutStream?: fs.WriteStream;
  private logErrStream?: fs.WriteStream;
  private logOutFilePath?: string;
  private logErrFilePath?: string;
  constructor(config: CpWrapperConfig) {
    this.resetStatus();
    this.setConfig(config);
  }
  static createOrphan(cpId: string, pid: number): CpWrapper {
    const mgr = new CpWrapper({id: cpId});
    mgr.isOrphan = true;
    mgr.orphanPid = pid;
    mgr.status = 'running';
    mgr.lastAction = 'start';
    return mgr;
  }
  resetStatus() {
    this.status = 'init';
    this.lastAction = 'none';
    this.retryCount = 0;
    this.logBuffer = [];
  }
  get id() {
    return this.config.id;
  }
  getConfig() {
    return this.config;
  }
  setConfig(config: CpWrapperConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {
        ...this.config,
        ...(config ?? {}),
      };
    }
  }
  getLogMode(): LogMode {
    return get(this.config, ['log', 'mode'], 'memory');
  }
  changeStatus(status: CpWrapperStatus['status']) {
    if (!canChangeToStatus(status, this.status)) {
      throw new Error(`Can't change to status[${status}] from status[${this.status}]`);
    }
    this.status = status;
  }
  getInfo(): CpWrapperInfo {
    const {
      id,
      config: {retry, log, spawnConfig: spawnOptions},
      status,
      lastAction,
      retryCount,
      cpInfo,
    } = this;
    const managerConfig =
      retry !== undefined || log !== undefined ? {retry, log} : undefined;
    const info: CpWrapperInfo = {
      id,
      managerConfig,
      status: {
        status,
        lastAction,
        retryCount,
      },
    };
    if (cpInfo) {
      info.cpInfo = serializeCpInfo(cpInfo);
    } else {
      info.cpInfo = serializeCpInfo({
        spawnConfig: spawnOptions,
      });
    }
    return info;
  }

  private getMaxLogLines(): number {
    return get(this.config, ['log', 'maxLines'], 1000);
  }

  private pushLog(source: 'stdout' | 'stderr', text: string) {
    const maxLines = this.getMaxLogLines();
    const timestamp = new Date().toLocaleString();
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.length > 0) {
        this.logBuffer.push(`[${source}] ${timestamp} ${line}`);
      }
    }
    if (this.logBuffer.length > maxLines) {
      this.logBuffer = this.logBuffer.slice(-maxLines);
    }
  }

  private setupLogCapture(stdout?: Readable, stderr?: Readable) {
    const handleStream = (stream: Readable, source: 'stdout' | 'stderr') => {
      const partialKey = source === 'stdout' ? 'stdoutPartial' : 'stderrPartial';
      stream.on('data', (chunk: Buffer) => {
        const text = this[partialKey] + chunk.toString();
        const lines = text.split('\n');
        this[partialKey] = lines.pop() ?? '';
        for (const line of lines) {
          if (line.length > 0) {
            this.pushLog(source, line);
          }
        }
      });
      stream.on('end', () => {
        if (this[partialKey]) {
          this.pushLog(source, this[partialKey]);
          this[partialKey] = '';
        }
      });
    };
    if (stdout) handleStream(stdout, 'stdout');
    if (stderr) handleStream(stderr, 'stderr');
  }

  private setupLogSocket(stdout?: Readable, stderr?: Readable) {
    const pid = this.cpInfo?.childProcess?.pid;
    if (!pid) return;
    const socketPath = getLogSocketPath(this.id, pid);
    makeSureDirExist(getCpDir(this.id));
    this.logSocketPath = socketPath;
    const server = net.createServer(client => {
      this.logSocketClients.add(client);
      client.on('close', () => this.logSocketClients.delete(client));
      client.on('error', () => this.logSocketClients.delete(client));
    });
    server.listen(socketPath);
    this.logSocketServer = server;
    const broadcast = (chunk: Buffer) => {
      for (const client of this.logSocketClients) {
        client.write(chunk);
      }
    };
    if (stdout) stdout.on('data', broadcast);
    if (stderr) stderr.on('data', broadcast);
  }

  private setupLogFile(stdout?: Readable, stderr?: Readable) {
    const pid = this.cpInfo?.childProcess?.pid;
    if (!pid) return;
    makeSureDirExist(getCpDir(this.id));
    const outPath = getLogOutFilePath(this.id, pid);
    const errPath = getLogErrorFilePath(this.id, pid);
    this.logOutFilePath = outPath;
    this.logErrFilePath = errPath;
    if (stdout) {
      this.logOutStream = fs.createWriteStream(outPath, {flags: 'a'});
      stdout.pipe(this.logOutStream);
    }
    if (stderr) {
      this.logErrStream = fs.createWriteStream(errPath, {flags: 'a'});
      stderr.pipe(this.logErrStream);
    }
  }

  persistPidInfo() {
    const pid = this.cpInfo?.childProcess?.pid ?? this.orphanPid;
    if (!pid) return;
    const record: PidInfoRecord = {
      pid,
      startAt: this.cpInfo?.spawnTime ?? new Date().toISOString(),
      status: 'running',
      logMode: this.getLogMode(),
      spawnConfig: this.config.spawnConfig,
    };
    try {
      savePidInfo(this.id, record);
    } catch (err) {
      console.error(`Failed to persist pid-info for ${this.id}:`, err);
    }
  }

  private updatePidInfoOnExit() {
    const pid = this.cpInfo?.childProcess?.pid ?? this.orphanPid;
    if (!pid) return;
    const record: PidInfoRecord = {
      pid,
      startAt: this.cpInfo?.spawnTime ?? new Date().toISOString(),
      status: 'exited',
      logMode: this.getLogMode(),
      spawnConfig: this.config.spawnConfig,
      exitAt: new Date().toISOString(),
    };
    try {
      savePidInfo(this.id, record);
    } catch (err) {
      console.error(`Failed to update pid-info on exit for ${this.id}:`, err);
    }
  }

  private cleanupLogResources() {
    if (this.logSocketServer) {
      for (const client of this.logSocketClients) {
        client.destroy();
      }
      this.logSocketClients.clear();
      this.logSocketServer.close();
      this.logSocketServer = undefined;
      // Clean up socket file
      if (this.logSocketPath) {
        try { fs.unlinkSync(this.logSocketPath); } catch {}
        this.logSocketPath = undefined;
      }
    }
    if (this.logOutStream) {
      this.logOutStream.end();
      this.logOutStream = undefined;
    }
    if (this.logErrStream) {
      this.logErrStream.end();
      this.logErrStream = undefined;
    }
  }

  private prepareStdioForLogging(spawnConfig: SpawnConfig): SpawnConfig {
    const config = {...spawnConfig};
    if (!config.spawnOptions) {
      config.spawnOptions = {};
    }
    const options = {...config.spawnOptions};
    let stdio = options.stdio as any[];
    if (!Array.isArray(stdio)) {
      return config;
    }
    stdio = [...stdio];
    if (stdio[1] === 'ignore') stdio[1] = 'pipe';
    if (stdio[2] === 'ignore') stdio[2] = 'pipe';
    options.stdio = stdio;
    config.spawnOptions = options;
    return config;
  }

  getLog(options?: {tail?: number}): ResponseLog['data'] {
    const mode = this.getLogMode();
    if (this.isOrphan) {
      return {id: this.id, mode: 'memory', lines: ['[orphan process - no log capture available]'], total: 1};
    }
    if (mode === 'socket') {
      return {id: this.id, mode: 'socket', socketPath: this.logSocketPath ?? ''};
    }
    if (mode === 'file') {
      return {
        id: this.id,
        mode: 'file',
        outFile: this.logOutFilePath ?? '',
        errorFile: this.logErrFilePath ?? '',
      };
    }
    // memory mode
    const {tail} = options ?? {};
    let lines = this.logBuffer;
    const total = lines.length;
    if (tail !== undefined && tail < lines.length) {
      lines = lines.slice(-tail);
    }
    return {id: this.id, mode: 'memory', lines: [...lines], total};
  }

  async onExit() {
    const {config, exitSignal, cpInfo, lastAction} = this;
    const {} = config;
    this.changeStatus('onExit');
    if (cpInfo) {
      cpInfo.deadTime = new Date().toLocaleString();
    }
    this.cleanupLogResources();
    this.updatePidInfoOnExit();
    const {minInterval, maxCount} = get(config, ['retry'], {});
    const letChildDie = () => {
      this.changeStatus('exited');
      if (exitSignal.resolve) {
        exitSignal.resolve();
      }
    };
    const restartChild = async () => {
      this.changeStatus('toRestart');
      await new Promise(res => {
        process.nextTick(res);
      });
      if (isNumber(minInterval)) {
        await waitFor(minInterval);
      }
      await this.trySpawn();
      this.retryCount++;
    };
    if (lastAction === 'stop' || lastAction === 'restart') {
      letChildDie();
    } else if (lastAction === 'start') {
      if (isNumber(maxCount) && this.retryCount < maxCount) {
        restartChild();
      } else {
        letChildDie();
      }
    } else {
      letChildDie();
    }
  }

  async waitExitComplete() {
    const {exitSignal} = this;
    return new Promise<void>((res, rej) => {
      exitSignal.resolve = res;
      exitSignal.reject = rej;
    });
  }

  async trySpawn() {
    if (this.isOrphan) return null;
    const {config, cpInfo} = this;
    /** Not throw erro when spawn child process and spawnConfig is null */
    if (!config || !config.spawnConfig) {
      // throw new Error(`Please provide spawnConfig`);
      return null;
    }
    const {spawnConfig: spawnOptions} = config;
    this.changeStatus('toSpawn');
    const logEnabledConfig = this.prepareStdioForLogging(spawnOptions);
    try {
      const spawnInfo = await spawnAndTryIpc(logEnabledConfig);
      this.stdoutPartial = '';
      this.stderrPartial = '';
      this.cpInfo = {
        spawnConfig: spawnOptions,
        ...spawnInfo,
      };
      const {childProcess} = spawnInfo;
      if (childProcess) {
        this.changeStatus('running');
        const logMode = this.getLogMode();
        if (logMode === 'socket') {
          this.setupLogSocket(childProcess.stdout, childProcess.stderr);
        } else if (logMode === 'file') {
          this.setupLogFile(childProcess.stdout, childProcess.stderr);
        } else {
          this.setupLogCapture(childProcess.stdout, childProcess.stderr);
        }
        this.persistPidInfo();
        childProcess.once('exit', code => {
          this.onExit();
        });
      }
      return this.cpInfo;
    } catch (err) {
      this.changeStatus('exited');
    }
  }

  async start(config?: CpWrapperConfig) {
    if (this.isOrphan) {
      throw new Error(`Cannot start an orphan process (${this.id}), only stop is supported`);
    }
    this.changeStatus('toStart');
    this.lastAction = 'start';
    this.retryCount = 0;
    if (config) {
      this.setConfig(config);
    }
    await this.trySpawn();
  }

  async stop() {
    if (this.isOrphan) {
      if (!this.orphanPid) {
        throw new Error(`orphan pid is null`);
      }
      this.status = 'toKill';
      this.lastAction = 'stop';
      await killProcessByPid([this.orphanPid]);
      this.status = 'exited';
      this.updatePidInfoOnExit();
      return;
    }
    const {cpInfo} = this;
    if (!cpInfo) {
      throw new Error(`cpInfo is null`);
    }
    const {childProcess} = cpInfo;
    if (!childProcess) {
      throw new Error(`childProcess is null`);
    }
    this.changeStatus('toKill');
    this.lastAction = 'stop';
    await killProcessByPid([childProcess.pid]);
    /** change status after killProcessByPid success */
    await this.waitExitComplete();
  }

  async restart(config?: CpWrapperConfig) {
    if (this.isOrphan) {
      throw new Error(`Cannot restart an orphan process (${this.id}), only stop is supported`);
    }
    this.lastAction = 'restart';
    if (canChangeToStatus('toKill', this.status)) {
      await this.stop();
    }
    await this.start(config);
  }
}
