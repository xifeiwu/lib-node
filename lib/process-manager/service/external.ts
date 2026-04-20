// Re-export functions from other directories for easier management

// From log
export {logColorful} from '../../../log';

// From path
export {makeSureDirExist} from '../../../path';

// From process
export {killProcessByPid, getProcessInfoByPid} from '../../../process/service';
export {isProcessAlive} from '../../../process/service/kill';

// From child-process/spawn
export {
  spawnAndTryIpc,
  spwanInDetachedMode,
  getSpawnConfigByScript,
  serializeSpawnResponse,
} from '../../../child-process/spawn';

export {getPreferredFileByExt} from '../../../path';

// From child-process/service
export {waitIpcMessageOnce} from '../../../child-process';

// From service/constants
export {PROCESS_MANAGER_ROOT_DIR} from '../../../service/constants';

// From types
export {CP} from '../../../types';
export {SpawnConfig, SpawnAndTryIpcResponse} from '../../../types/child_process/common';

// From utils/write
export {createRollingSnapshotWriter} from '../../../utils/write/snapshot';
export type {RollingSnapshotWriter} from '../../../utils/write/snapshot';
export {createRollingLogWriter} from '../../../utils/write/log';
export type {RollingLogWriter} from '../../../utils/write/log';

// From external (utility functions)
export {isNumber, isPlainObject, isString, waitFor, get} from '../../../external';
