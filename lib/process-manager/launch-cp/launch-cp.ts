import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {
  spawnAndTryIpc,
  createRollingSnapshotWriter,
  createRollingLogWriter,
  makeSureDirExist,
  killProcessByPid,
  isNumber,
  waitFor,
  get,
} from '../service/external';
import type {RollingSnapshotWriter, RollingLogWriter} from '../service/external';
import {getCpInfoDir, getCpInfoPath, getCpLogDir} from '../service';
import {isProcessAlive} from '../../../process/service/kill';
import {
  DETACHED_STDIO,
  MONITORED_STDIO,
  PROCESS_INFO_FILE_NAME,
  LaunchCpRuntime,
  LaunchCpConfig,
  LaunchCpInfo,
  LaunchCpType,
  MonitorConfig,
  ResponseLog,
} from '../service';
import {SpawnConfig, SpawnAndTryIpcResponse} from '../service/external';

// ─── shared helpers ───

const phaseConvertRule: Partial<{
  [phase in LaunchCpRuntime['phase']]: Array<LaunchCpRuntime['phase']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};

export function canChangePhase(to: LaunchCpRuntime['phase'], from: LaunchCpRuntime['phase']) {
  return !phaseConvertRule[to] || phaseConvertRule[to].includes(from);
}

export function validateAndApplyStdio(spawnConfig: SpawnConfig, defaultStdio: any[]): SpawnConfig {
  const config = {...spawnConfig};
  if (!config.spawnOptions) {
    config.spawnOptions = {};
  }
  config.spawnOptions = {...config.spawnOptions};
  const userStdio = config.spawnOptions.stdio;
  if (!userStdio) {
    config.spawnOptions.stdio = defaultStdio;
    return config;
  }
  if (!Array.isArray(userStdio)) {
    throw new Error(`stdio must be an array, got: ${JSON.stringify(userStdio)}`);
  }
  const stdio = [...userStdio] as any[];
  for (let i = 0; i < defaultStdio.length; i++) {
    const userVal = stdio[i];
    const defaultVal = defaultStdio[i];
    if (userVal === undefined) {
      stdio[i] = defaultVal;
    } else if (userVal !== defaultVal) {
      throw new Error(`stdio[${i}] is set to '${userVal}', but '${defaultVal}' is required for this mode`);
    }
  }
  config.spawnOptions.stdio = stdio;
  return config;
}

function loadInfoFromFile(filePath: string): LaunchCpInfo | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function cleanInfoDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    return;
  }
  const entries = fs.readdirSync(dir);
  for (const entry of entries) {
    try {
      fs.unlinkSync(path.join(dir, entry));
    } catch {
      /* ignore */
    }
  }
}

// ─── monitored-mode concern functions ───

function setupLogPipe(
  logDir: string,
  stdout?: Readable,
  stderr?: Readable
): {outWriter?: RollingLogWriter; errWriter?: RollingLogWriter} {
  let outWriter: RollingLogWriter | undefined;
  let errWriter: RollingLogWriter | undefined;
  if (stdout) {
    outWriter = createRollingLogWriter({dir: logDir, basename: 'out.log'});
    stdout.on('data', (chunk: Buffer) => {
      outWriter.write(chunk);
    });
  }
  if (stderr) {
    errWriter = createRollingLogWriter({dir: logDir, basename: 'err.log'});
    stderr.on('data', (chunk: Buffer) => {
      errWriter.write(chunk);
    });
  }
  return {outWriter, errWriter};
}

function cleanupLogWriters(outWriter?: RollingLogWriter, errWriter?: RollingLogWriter) {
  if (outWriter) {
    outWriter.end();
  }
  if (errWriter) {
    errWriter.end();
  }
}

function handleExitRetry(
  launchCp: LaunchCp,
  monitorConfig: MonitorConfig | undefined,
  exitSignal: {resolve?: () => void}
) {
  const {lastAction} = launchCp;
  const {minInterval, maxCount} = get(monitorConfig, ['retry'], {});
  const letChildDie = () => {
    launchCp.changePhase('exited');
    if (exitSignal.resolve) {
      exitSignal.resolve();
    }
  };
  const restartChild = async () => {
    launchCp.changePhase('toRestart');
    await new Promise(res => {
      process.nextTick(res);
    });
    if (isNumber(minInterval)) {
      await waitFor(minInterval);
    }
    await launchCp.trySpawn();
    launchCp.retryCount++;
  };
  if (lastAction === 'stop' || lastAction === 'restart') {
    letChildDie();
  } else if (lastAction === 'start') {
    if (isNumber(maxCount) && launchCp.retryCount < maxCount) {
      restartChild();
    } else {
      letChildDie();
    }
  } else {
    letChildDie();
  }
}

// ─── LaunchCp class ───

export class LaunchCp {
  config: LaunchCpConfig;
  phase: LaunchCpRuntime['phase'];
  lastAction: LaunchCpRuntime['lastAction'];
  cpResponse?: SpawnAndTryIpcResponse;
  actualSpawnConfig?: SpawnConfig;
  private type: LaunchCpType;
  private monitorConfig?: MonitorConfig;
  retryCount = 0;
  private exitSignal: {resolve?: () => void; reject?: (err: Error) => void} = {};
  private logOutWriter?: RollingLogWriter;
  private logErrWriter?: RollingLogWriter;
  private infoWriter?: RollingSnapshotWriter;

  constructor(config: LaunchCpConfig) {
    this.phase = 'init';
    this.lastAction = 'none';
    this.setConfig(config);
  }

  get id() {
    return this.config.id;
  }

  setConfig(config: LaunchCpConfig) {
    if (!this.config) {
      this.config = config;
    } else {
      this.config = {...this.config, ...(config ?? {})};
    }
  }

  changePhase(next: LaunchCpRuntime['phase']) {
    if (!canChangePhase(next, this.phase)) {
      throw new Error(`Can't change to phase[${next}] from phase[${this.phase}]`);
    }
    this.phase = next;
    this.persistInfo();
  }

  getInfo(): LaunchCpInfo {
    const {type, config, phase, lastAction, cpResponse} = this;
    const info: LaunchCpInfo = {
      type,
      config,
      runtime: {phase, lastAction, spawnConfig: this.actualSpawnConfig},
    };
    if (this.type === 'with-daemon') {
      info.monitorInfo = {
        id: process.pid,
        retryCount: this.retryCount,
      };
    }
    if (cpResponse) {
      const {childProcess, ...rest} = cpResponse;
      info.spawnInfo = {pid: childProcess?.pid, ...rest};
    }
    return info;
  }

  // getLog(): ResponseLog['data'] {
  //   return {
  //     id: this.id,
  //     outFile: this.logOutWriter?.basePath ?? '',
  //     errorFile: this.logErrWriter?.basePath ?? '',
  //   };
  // }

  // ─── start modes ───

  async startInDetachedMode() {
    this.type = 'detached';
    this.checkExistingProcess();
    this.changePhase('toStart');
    this.lastAction = 'start';
    await this.trySpawn();
  }

  async startInMonitoredMode(monitorConfig?: MonitorConfig) {
    this.type = 'with-daemon';
    this.monitorConfig = monitorConfig;
    this.retryCount = 0;
    this.checkExistingProcess();
    this.changePhase('toStart');
    this.lastAction = 'start';
    await this.trySpawn();
  }

  async stop() {
    const {cpResponse} = this;
    if (!cpResponse) {
      throw new Error(`cpResponse is null`);
    }
    const {childProcess} = cpResponse;
    if (!childProcess) {
      throw new Error(`childProcess is null`);
    }
    this.changePhase('toKill');
    this.lastAction = 'stop';
    await killProcessByPid([childProcess.pid]);
    await this.waitExitComplete();
  }

  async restart() {
    this.lastAction = 'restart';
    if (canChangePhase('toKill', this.phase)) {
      await this.stop();
    }
    if (this.type === 'detached') {
      await this.startInDetachedMode();
    } else {
      await this.startInMonitoredMode(this.monitorConfig);
    }
  }

  // ─── spawn internals ───

  async trySpawn() {
    const {config} = this;
    if (!config || !config.spawnConfig) {
      return null;
    }
    const {spawnConfig} = config;
    this.changePhase('toSpawn');
    const prepared = this.prepareSpawnConfig(spawnConfig);
    this.actualSpawnConfig = prepared;
    this.persistInfo();
    try {
      this.cpResponse = await spawnAndTryIpc(prepared);
      const {childProcess} = this.cpResponse;
      if (childProcess) {
        this.changePhase('running');
        this.afterSpawn();
      }
      return this.cpResponse;
    } catch (err) {
      this.changePhase('exited');
    }
  }

  private prepareSpawnConfig(spawnConfig: SpawnConfig): SpawnConfig {
    if (this.type === 'detached') {
      const config = validateAndApplyStdio(spawnConfig, DETACHED_STDIO);
      config.spawnOptions = {...config.spawnOptions, detached: true};
      return config;
    } else {
      return validateAndApplyStdio(spawnConfig, MONITORED_STDIO);
    }
  }

  private afterSpawn() {
    if (this.type === 'detached') {
      const {childProcess} = this.cpResponse;
      if (childProcess) {
        childProcess.disconnect?.();
        childProcess.unref();
      }
    } else {
      const {childProcess} = this.cpResponse;
      const logDir = getCpLogDir(this.id);
      const {outWriter, errWriter} = setupLogPipe(logDir, childProcess.stdout, childProcess.stderr);
      this.logOutWriter = outWriter;
      this.logErrWriter = errWriter;
      childProcess.once('exit', () => {
        this.onExit();
      });
    }
  }

  private onExit() {
    const {cpResponse} = this;
    this.changePhase('onExit');
    if (cpResponse) {
      cpResponse.deadTime = new Date().toLocaleString();
    }
    cleanupLogWriters(this.logOutWriter, this.logErrWriter);
    this.logOutWriter = undefined;
    this.logErrWriter = undefined;
    handleExitRetry(this, this.monitorConfig, this.exitSignal);
  }

  private waitExitComplete() {
    return new Promise<void>((res, rej) => {
      this.exitSignal.resolve = res;
      this.exitSignal.reject = rej;
    });
  }

  private checkExistingProcess(): void {
    const info = loadInfoFromFile(getCpInfoPath(this.id));
    if (!info) {
      return;
    }
    const pid = info.spawnInfo?.pid;
    if (pid && isProcessAlive(pid)) {
      throw new Error(
        `Process with id '${this.id}' is already running (pid: ${pid}). ` +
          `Stop the existing process before starting a new one.`
      );
    }
  }

  private getInfoWriter(): RollingSnapshotWriter {
    if (!this.infoWriter) {
      const dir = getCpInfoDir(this.id);
      cleanInfoDir(dir);
      this.infoWriter = createRollingSnapshotWriter({
        dir,
        basename: PROCESS_INFO_FILE_NAME,
        format: 'json',
      });
    }
    return this.infoWriter;
  }

  persistInfo() {
    this.getInfoWriter().save(this.getInfo(), err => {
      if (err) {
        console.error(`Failed to persist info for ${this.id}:`, err);
      }
    });
  }

  flushInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.getInfoWriter().flush(err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  protected mergeLogPathsIntoInfoToCp(spawnConfig: SpawnConfig): SpawnConfig {
    const logDir = getCpLogDir(this.id);
    makeSureDirExist(logDir);
    const logOutPath = path.join(logDir, 'out.log');
    const logErrPath = path.join(logDir, 'err.log');
    return {
      ...spawnConfig,
      infoToCp: {
        ...spawnConfig.infoToCp,
        logOutPath,
        logErrPath,
      },
    };
  }
}
