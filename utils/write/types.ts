export interface RollingLogWriterOptions {
  dir: string;
  /** Filename only, e.g. `app.log` */
  basename: string;
  /** Single active log file max size in bytes, or a human-readable size string passed to `wordToByte` (e.g. `10M`, `1.5G`). Default 10MB */
  maxFileSize?: number | string;
  /** Max total size of related log files under `dir` in bytes, or a string for `wordToByte`. Default 100MB */
  maxTotalSize?: number | string;
  /** Max number of related log files (including the active file). Default 100 */
  maxFileCount?: number;
}

export type RollingSnapshotFormat = 'json' | 'commonjs';

export interface RollingSnapshotWriterOptions {
  dir: string;
  /** Filename only, e.g. `state.json`. Latest snapshot is always `path.join(dir, basename)`. */
  basename: string;
  /** Max number of related snapshot files (including the active `basename`). Default 100. */
  maxFileCount?: number;
  /**
   * File body format. `json` (default): pretty-printed JSON.
   * `commonjs`: `convertObjectToCjsExport` (one `module.exports.key = ...` per top-level key).
   */
  format?: RollingSnapshotFormat;
}
