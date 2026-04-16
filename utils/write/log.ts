import fs from 'fs';
import path from 'path';
import {formatDate, wordToByte} from '../../external';
import {makeSureDirExist} from '../../path';

const M = 1024 * 1024;
const DEFAULT_MAX_FILE_SIZE = 10 * M;
const DEFAULT_MAX_TOTAL_SIZE = 100 * M;
const DEFAULT_MAX_FILE_COUNT = 100;

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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveByteSizeOption(value: number | string | undefined, defaultBytes: number): number {
  if (value === undefined) {
    return defaultBytes;
  }
  if (typeof value === 'number') {
    return value;
  }
  return wordToByte(value);
}

/**
 * Rolling file logger: always appends to `path.join(dir, basename)` until it reaches `maxFileSize`,
 * then renames to `name + yyyy-MM-dd + ext`, with `-index` before ext if that name exists.
 * When total size or file count exceeds limits, deletes oldest files by mtime (never deletes the active basename while it is open).
 */
export class RollingLogWriter {
  private readonly dir: string;
  readonly basename: string;
  private readonly maxFileSize: number;
  private readonly maxTotalSize: number;
  private readonly maxFileCount: number;
  readonly basePath: string;
  private stream: fs.WriteStream | null = null;
  /** Size of `basePath` on disk when current stream was opened */
  private fileSizeAtOpen = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(options: RollingLogWriterOptions) {
    const {
      dir,
      basename,
      maxFileSize = DEFAULT_MAX_FILE_SIZE,
      maxTotalSize = DEFAULT_MAX_TOTAL_SIZE,
      maxFileCount = DEFAULT_MAX_FILE_COUNT,
    } = options;
    this.dir = path.resolve(dir);
    this.basename = basename;
    this.basePath = path.join(this.dir, basename);
    this.maxFileSize = resolveByteSizeOption(maxFileSize, DEFAULT_MAX_FILE_SIZE);
    this.maxTotalSize = resolveByteSizeOption(maxTotalSize, DEFAULT_MAX_TOTAL_SIZE);
    this.maxFileCount = maxFileCount;
  }

  private bareNameAndExt(): {name: string; ext: string} {
    const {name, ext} = path.parse(this.basename);
    return {name, ext};
  }

  /** Rotated name: `name` + `yyyy-MM-dd` + `ext`; collision → `name` + `yyyy-MM-dd` + `-` + index + `ext` */
  private allocateArchivePath(dateStr: string): string {
    const {name, ext} = this.bareNameAndExt();
    const primary = path.join(this.dir, `${name}${dateStr}${ext}`);
    if (!fs.existsSync(primary)) {
      return primary;
    }
    let i = 1;
    for (;;) {
      const candidate = path.join(this.dir, `${name}${dateStr}-${i}${ext}`);
      if (!fs.existsSync(candidate)) {
        return candidate;
      }
      i += 1;
    }
  }

  /** Match archive files for this basename (not the active filename itself). */
  private archiveNamePattern(): RegExp {
    const {name, ext} = this.bareNameAndExt();
    return new RegExp(`^${escapeRegex(name)}\\d{4}-\\d{2}-\\d{2}(-\\d+)?${escapeRegex(ext)}$`);
  }

  private collectRelatedFiles(): {full: string; mtimeMs: number; size: number}[] {
    const list: {full: string; mtimeMs: number; size: number}[] = [];
    const re = this.archiveNamePattern();
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(this.dir, {withFileTypes: true});
    } catch {
      return list;
    }
    for (const ent of entries) {
      if (!ent.isFile()) {
        continue;
      }
      const fn = ent.name;
      if (fn !== this.basename && !re.test(fn)) {
        continue;
      }
      const full = path.join(this.dir, fn);
      try {
        const st = fs.statSync(full);
        list.push({full, mtimeMs: st.mtimeMs, size: st.size});
      } catch {
        /* skip race */
      }
    }
    list.sort((a, b) => a.mtimeMs - b.mtimeMs);
    return list;
  }

  /**
   * Drop oldest related files until within `maxTotalSize` and `maxFileCount`.
   * Never deletes `basePath` (active log slot).
   */
  enforceRetention(): void {
    const basePathNorm = path.normalize(this.basePath);
    for (;;) {
      const files = this.collectRelatedFiles();
      const totalSize = files.reduce((s, f) => s + f.size, 0);
      if (totalSize <= this.maxTotalSize && files.length <= this.maxFileCount) {
        return;
      }
      const victim = files.find(f => path.normalize(f.full) !== basePathNorm);
      if (!victim) {
        return;
      }
      try {
        fs.unlinkSync(victim.full);
      } catch {
        return;
      }
    }
  }

  private getCurrentSize(): number {
    if (!this.stream) {
      try {
        return fs.existsSync(this.basePath) ? fs.statSync(this.basePath).size : 0;
      } catch {
        return 0;
      }
    }
    return this.fileSizeAtOpen + this.stream.bytesWritten;
  }

  private openStreamFresh(): void {
    makeSureDirExist(this.dir);
    const existed = fs.existsSync(this.basePath);
    this.fileSizeAtOpen = existed ? fs.statSync(this.basePath).size : 0;
    this.stream = fs.createWriteStream(this.basePath, {flags: 'a'});
  }

  private async closeStreamForRotate(): Promise<void> {
    if (!this.stream) {
      return;
    }
    const s = this.stream;
    this.stream = null;
    this.fileSizeAtOpen = 0;
    await new Promise<void>((resolve, reject) => {
      s.end(() => resolve());
      s.on('error', reject);
    });
  }

  private async rotate(): Promise<void> {
    await this.closeStreamForRotate();
    if (fs.existsSync(this.basePath)) {
      const dateStr = formatDate(new Date(), 'yyyy-MM-dd');
      const target = this.allocateArchivePath(dateStr);
      fs.renameSync(this.basePath, target);
    }
    this.enforceRetention();
    this.openStreamFresh();
  }

  private async ensureStreamAndMaybeRotate(): Promise<void> {
    if (!this.stream) {
      this.openStreamFresh();
    }
    if (this.getCurrentSize() >= this.maxFileSize) {
      await this.rotate();
    }
  }

  /**
   * Append `data` to the active log file. Serializes writes and rotation on the same instance.
   */
  write(data: string | Uint8Array, cb?: (err?: Error) => void): void;
  write(data: string | Uint8Array, encoding: BufferEncoding, cb?: (err?: Error) => void): void;
  write(
    data: string | Uint8Array,
    encodingOrCb?: BufferEncoding | ((err?: Error) => void),
    cb?: (err?: Error) => void
  ): void {
    let encoding: BufferEncoding | undefined;
    let callback = cb;
    if (typeof encodingOrCb === 'function') {
      callback = encodingOrCb;
    } else {
      encoding = encodingOrCb;
    }

    this.chain = this.chain
      .then(async () => {
        await this.ensureStreamAndMaybeRotate();
        const stream = this.stream;
        if (!stream) {
          throw new Error('RollingLogWriter: stream is null after open');
        }
        await new Promise<void>((resolve, reject) => {
          const onDone = (err?: Error | null) => (err ? reject(err) : resolve());
          if (encoding !== undefined && typeof data === 'string') {
            stream.write(data, encoding, onDone);
          } else {
            stream.write(data, onDone);
          }
        });
      })
      .then(
        () => {
          callback?.();
        },
        (err: Error) => {
          callback?.(err);
        }
      );
  }

  /** Finish queued writes and close the active file stream. */
  end(cb?: (err?: Error) => void): void {
    this.chain = this.chain
      .then(
        async () => {
          await this.closeStreamForRotate();
        },
        async () => {
          await this.closeStreamForRotate();
        }
      )
      .then(
        () => cb?.(),
        (err: Error) => cb?.(err)
      );
  }
}

export function createRollingLogWriter(options: RollingLogWriterOptions): RollingLogWriter {
  return new RollingLogWriter(options);
}
