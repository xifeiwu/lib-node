// Re-export functions from other directories for easier management
// Functions used in lib/daemon from other directories

// From log
export {logColorful} from '../../log';

// From fs
export {getFileList} from '../../fs';
export {writeFileSync} from '../../fs/write';

// From path
export {makeSureDirExist} from '../../path';

// From net
export {startSocketClient} from '../../net/service/client';
export {oneChatFromSocketClient, startOneChatSocketServer} from '../../net/one-chat';

// From transform
export {fromBuffer} from '../../transform/buffer';

// From process
export {killProcessByPid} from '../../process/service';

// From child-process/spawn
export {
  spawnAndTryIpc,
  getSpawnConfigByScript,
  serializeSpawnResponse,
  getSpawnAndIpcConfigByScript,
} from '../../child-process/spawn';

// From child-process/service
export {tryUseJsFile, waitIpcMessageOnce} from '../../child-process';
export {outOnAllChannels} from '../../utils/cp-script';

// From service/constants
export {PROCESS_MANAGER_ROOT_DIR as DAEMON_ROOT_DIR, DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from '../../service/constants';

// From types
export {CP, InfoToCp, TcpServerInfo, TcpServerConfig} from '../../types';
// Re-export types used in daemon types
export {SpawnConfig, SpawnAndTryIpcResponse} from '../../types/child_process/common';

// From utils/write
export {createRollingSnapshotWriter} from '../../utils/write/snapshot';
export type {RollingSnapshotWriter} from '../../utils/write/snapshot';
export {createRollingLogWriter} from '../../utils/write/log';
export type {RollingLogWriter} from '../../utils/write/log';

// From external (utility functions)
export {isNumber, isObject, isPlainObject, isString, waitFor, get} from '../../external';
