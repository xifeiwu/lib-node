export const MAX_WAIT_TIME_DEBUG_MODE = 120;

/** Default stdio for detached child: stdin/stdout/stderr ignore, IPC for handshake. */
export const DETACHED_STDIO = ['ignore', 'ignore', 'ignore', 'ipc'];

/** Default stdio for daemon-monitored child: pipes for log collection + IPC. */
export const MONITORED_STDIO = ['ignore', 'pipe', 'pipe', 'ipc'];

/** Basename of the rolling JSON snapshot under each cp's `info/` dir. */
export const PROCESS_INFO_FILE_NAME = 'index.json';
