import fs from 'fs';
import path from 'path';
import {Readable} from 'stream';
import {
  spawnAndTryIpc,
  getSpawnConfigByScript,
  createRollingSnapshotWriter,
  createRollingLogWriter,
  makeSureDirExist,
  killProcessByPid,
  isNumber,
  isPlainObject,
  isString,
  waitFor,
  get,
} from '../service/external';
import type {RollingSnapshotWriter, RollingLogWriter} from '../service/external';
import type {SpawnConfig, SpawnAndTryIpcResponse} from '../service/external';
import {getCpInfoDir, getCpLogDir, loadCpInfo} from '../service';
import {isProcessAlive} from '../../../process/service/kill';
import {
  DETACHED_STDIO,
  MONITORED_STDIO,
  PROCESS_INFO_FILE_NAME,
  LaunchCpConfig,
  LaunchCpEntry,
  LaunchCpInfo,
  LaunchCpMode,
  LaunchCpRuntime,
  MonitorConfig,
  MonitorInfo,
  DaemonConfig,
  DaemonInfo,
} from '../service';
import {validateAndApplyStdio} from './monitored';

// ─── LaunchCp helpers ───

const phaseConvertRule: Partial<{
  [phase in LaunchCpRuntime['phase']]: Array<LaunchCpRuntime['phase']>;
}> = {
  toStart: ['init', 'exited'],
  toSpawn: ['init', 'toStart', 'toRestart', 'exited'],
  running: ['toSpawn'],
  toKill: ['running'],
  toRestart: ['onExit'],
};

function canChangePhase(to: LaunchCpRuntime['phase'], from: LaunchCpRuntime['phase']) {
  return !phaseConvertRule[to] || phaseConvertRule[to].includes(from);
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
      outWriter.write(chunk);
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
  private mode: LaunchCpMode;
  private monitorConfig?: MonitorConfig;
  retryCount: MonitorInfo['retryCount'] = 0;
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
    this.config = config;
  }

  changePhase(next: LaunchCpRuntime['phase']) {
    if (!canChangePhase(next, this.phase)) {
      throw new Error(`Can't change to phase[${next}] from phase[${this.phase}]`);
    }
    this.phase = next;
    this.persistInfo();
  }

  getInfo(): LaunchCpInfo {
    const {mode, config, phase, lastAction, cpResponse} = this;
    const info: LaunchCpInfo = {
      mode,
      config,
      runtime: {phase, lastAction, spawnConfig: this.actualSpawnConfig},
    };
    if (this.mode === 'monitored') {
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

  // ─── start modes ───
  async startInDetachedMode() {
    this.mode = 'detached';
    this.checkExistingProcess();
    this.changePhase('toStart');
    this.lastAction = 'start';
    await this.trySpawn();
  }

  async startInMonitoredMode(monitorConfig?: MonitorConfig) {
    this.mode = 'monitored';
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
    if (this.mode === 'detached') {
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
    const spawnConfig =
      typeof config.spawnConfig === 'string'
        ? getSpawnConfigByScript(config.spawnConfig)
        : config.spawnConfig;
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
    if (this.mode === 'detached') {
      const config = validateAndApplyStdio(spawnConfig, DETACHED_STDIO);
      config.spawnOptions = {...config.spawnOptions, detached: true};
      return config;
    } else {
      return validateAndApplyStdio(spawnConfig, MONITORED_STDIO);
    }
  }

  private afterSpawn() {
    if (this.mode === 'detached') {
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
    const info = loadCpInfo(this.id);
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

// ─── Daemon class ───

export class Daemon {
  config: DaemonConfig;
  launchCpIdToInst: {
    [id: string]: LaunchCp;
  } = {};
  constructor(config: DaemonConfig) {
    this.config = config;
  }

  getLaunchCpInst(cpConfigOrId?: string | LaunchCpConfig) {
    const {launchCpIdToInst} = this;
    let inst: LaunchCp;
    if (cpConfigOrId === undefined) {
      const allLaunchCp = Object.values(launchCpIdToInst);
      if (allLaunchCp.length === 1) {
        inst = allLaunchCp[0];
      }
    } else if (isString(cpConfigOrId)) {
      inst = launchCpIdToInst[cpConfigOrId as string];
    } else if (isPlainObject(cpConfigOrId)) {
      const {id} = cpConfigOrId as LaunchCpConfig;
      if (id === undefined) {
        throw new Error(`id is undefined in cpConfig`);
      }
      inst = launchCpIdToInst[id];
      if (inst === undefined) {
        inst = new LaunchCp(cpConfigOrId as LaunchCpConfig);
        launchCpIdToInst[id] = inst;
      }
    }
    return inst;
  }

  async launchCp(entry: LaunchCpEntry) {
    const {cpConfig, monitorConfig} = entry;
    const inst = this.getLaunchCpInst(cpConfig);
    await inst.startInMonitoredMode(monitorConfig);
    return inst.getInfo();
  }

  async launchAllCpInConfigList() {
    const {launchCpConfigList} = this.config;
    if (Array.isArray(launchCpConfigList)) {
      for (const entry of launchCpConfigList) {
        try {
          await this.launchCp(entry);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  getDaemonInfo() {
    const {config, launchCpIdToInst} = this;
    const {launchCpConfigList: cpConfigList, ...restConfig} = config ?? {};
    const daemonInfo: DaemonInfo = {
      pid: process.pid,
      config: restConfig,
      cpInfoList: Object.values(launchCpIdToInst).map(it => it.getInfo()),
    };
    return daemonInfo;
  }

  getInfo(id?: string) {
    const {config, launchCpIdToInst} = this;
    if (id === undefined) {
      return this.getDaemonInfo();
    } else {
      const inst = launchCpIdToInst[id];
      if (!inst) {
        throw new Error(`Not found cpWrapper with id: ${id}`);
      }
      return inst.getInfo();
    }
  }

  async stopDaemon() {
    const {launchCpIdToInst} = this;
    for (const cpWrapper of Object.values(launchCpIdToInst)) {
      try {
        await cpWrapper.stop();
      } catch (err) {
        console.error(err);
      }
    }
  }

  async stop(id: string) {
    const {launchCpIdToInst} = this;
    const inst = launchCpIdToInst[id];
    if (inst) {
      await inst.stop();
    } else {
      throw new Error(`No target found by id: ${id}`);
    }
  }
}
