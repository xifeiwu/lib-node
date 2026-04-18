export const MAX_WAIT_TIME_DEBUG_MODE = 120;

/** Default stdio for detached child: stdin/stdout/stderr ignore, IPC for handshake. */
export const DETACHED_STDIO = ['ignore', 'ignore', 'ignore', 'ipc'];

/** Default stdio for daemon-monitored child: pipes for log collection + IPC. */
export const MONITORED_STDIO = ['ignore', 'pipe', 'pipe', 'ipc'];

/** Basename of the rolling JSON snapshot under each cp's `info/` dir. */
export const PROCESS_INFO_FILE_NAME = 'index.json';

/** Basename of child stdout log under each cp's `log/` dir. */
export const PROCESS_LOG_OUT_FILE_NAME = 'out.log';
/** Basename of child stderr log under each cp's `log/` dir. */
export const PROCESS_LOG_ERR_FILE_NAME = 'err.log';

/** Basename of the monitor lifecycle log under each cp's `monitor/` dir. */
export const MONITOR_CHANGES_FILE_NAME = 'changes.log';
