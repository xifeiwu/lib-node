// Re-export functions from other directories for easier management
// Functions used in lib/daemon from other directories

// From log
export {logColorful} from '../../log';

// From fs
export {getFileList} from '../../fs';

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
export {DAEMON_SOCKET_DIR, SOCKET_FILE_SUFFIX} from '../../service/constants';

// From types
export {CP, InfoToCp, TcpServerInfo, TcpServerConfig} from '../../types';
// Re-export types used in daemon types
export {SpawnConfig, SpawnAndTryIpcResponse} from '../../types/child_process/common';

// From external (utility functions)
export {isNumber, isObject, isPlainObject, isString, waitFor, get} from '../../external';
