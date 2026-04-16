import {isPlainObject, isString} from '../service/external';
import {LaunchCpConfig, DaemonConfig, DaemonInfo} from '../service';
import {LaunchCpWithDaemon} from './with-daemon';

export class Daemon {
  config: DaemonConfig;
  launchCpIdToInst: {
    [id: string]: LaunchCpWithDaemon;
  } = {};
  constructor(config: DaemonConfig) {
    this.config = config;
  }

  /**
   * Get cpWrapper by config or id; create a new cpWrapper if cpConfig is passed and not found.
   */
  getLaunchCpInst(cpConfigOrId?: string | LaunchCpConfig) {
    const {launchCpIdToInst} = this;
    let inst: LaunchCpWithDaemon;
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
        inst = new LaunchCpWithDaemon(cpConfigOrId as LaunchCpConfig);
        launchCpIdToInst[id] = inst;
      }
    }
    return inst;
  }

  /** start one child process */
  async launchCp(cpConfig: LaunchCpConfig) {
    const cpWrapper = this.getLaunchCpInst(cpConfig);
    await cpWrapper.start(cpConfig);
    return cpWrapper.getInfo();
  }

  /** Start all child process configured in config */
  async launchAllCpInConfigList() {
    const {launchCpConfigList} = this.config;
    /** Child process should start one by one */
    if (Array.isArray(launchCpConfigList)) {
      for (const cpConfig of launchCpConfigList) {
        /** One process failure should not stop other child process startup */
        try {
          await this.launchCp(cpConfig);
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

  /**
   * Return child process info if cpWrapper exists, else return daemon info.
   * @param id daemon id or child process id
   */
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

  /**
   * Stop daemon process and all child processes it managed
   */
  async stopDaemon() {
    const {launchCpIdToInst} = this;
    for (const cpWrapper of Object.values(launchCpIdToInst)) {
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
    const {launchCpIdToInst} = this;
    const inst = launchCpIdToInst[id];
    if (inst) {
      await inst.stop();
    } else {
      throw new Error(`No target found by id: ${id}`);
    }
  }
}
