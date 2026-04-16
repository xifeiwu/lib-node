import {
  isPlainObject,
  isString,
} from '../external';
import {
  LaunchCpConfig,
  DaemonConfig,
  DaemonInfo,
} from '../types';
import {LaunchCpWithDaemon} from './with-daemon';

export class Daemon {
  config: DaemonConfig;
  cpWrapperMap: {
    [id: string]: LaunchCpWithDaemon;
  } = {};
  constructor() {}

  /** start one child process */
  async startCp(cpConfig: LaunchCpConfig) {
    const cpWrapper = this.getLaunchCpInst(cpConfig);
    await cpWrapper.start(cpConfig);
    return cpWrapper.getInfo();
  }

  /** Start all child process configured in config */
  async startAllCp() {
    const {launchCpConfigList: cpConfigList} = this.config;
    /** Child process should start one by one */
    if (Array.isArray(cpConfigList)) {
      for (const cpConfig of cpConfigList) {
        /** One process failure should not stop other child process startup */
        try {
          await this.startCp(cpConfig);
        } catch (err) {
          console.error(err);
        }
      }
    }
  }

  getDaemonInfo() {
    const {config, cpWrapperMap} = this;
    const {launchCpConfigList: cpConfigList, ...restConfig} = config ?? {};
    const daemonInfo: DaemonInfo = {
      pid: process.pid,
      config: restConfig,
      cpInfoList: Object.values(cpWrapperMap).map(it => it.getInfo()),
    };
    return daemonInfo;
  }

  /**
   * Return child process info if cpWrapper exists, else return daemon info.
   * @param id daemon id or child process id
   */
  getInfo(id?: string) {
    const {config, cpWrapperMap} = this;
    if (id === undefined) {
      return this.getDaemonInfo();
    } else {
      const cpWrapper = cpWrapperMap[id];
      if (!cpWrapper) {
        throw new Error(`Not found cpWrapper with id: ${id}`);
      }
      return cpWrapper.getInfo();
    }
  }

  /**
   * Stop daemon process and all child processes it managed
   */
  async stopDaemon() {
    const {cpWrapperMap} = this;
    for (const cpWrapper of Object.values(cpWrapperMap)) {
      /** One process failure should not stop other child process shutdown */
      try {
        await cpWrapper.stop();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Stop child process or daemon (prioritise child process), and return corresponding info
   */
  async stop(id: string) {
    const {cpWrapperMap} = this;
    const cpWrapper = cpWrapperMap[id];
    if (cpWrapper) {
      await cpWrapper.stop();
    } else {
      throw new Error(`No target found by id: ${id}`);
    }
  }

  /**
   * Get cpWrapper by config or id; create a new cpWrapper if cpConfig is passed and not found.
   */
  getLaunchCpInst(cpConfigOrId?: string | LaunchCpConfig) {
    const {cpWrapperMap} = this;
    let inst: LaunchCpWithDaemon;
    if (cpConfigOrId === undefined) {
      const allLaunchCp = Object.values(cpWrapperMap);
      if (allLaunchCp.length === 1) {
        inst = allLaunchCp[0];
      }
    } else if (isString(cpConfigOrId)) {
      inst = cpWrapperMap[cpConfigOrId as string];
    } else if (isPlainObject(cpConfigOrId)) {
      const {id} = cpConfigOrId as LaunchCpConfig;
      if (id === undefined) {
        throw new Error(`id is undefined in cpConfig`);
      }
      inst = cpWrapperMap[id];
      if (inst === undefined) {
        inst = new LaunchCpWithDaemon(cpConfigOrId as LaunchCpConfig);
        cpWrapperMap[id] = inst;
      }
    }
    return inst;
  }
}
