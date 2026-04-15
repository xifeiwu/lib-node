import fs from 'fs';
import path from 'path';
import {formatDate} from '../../external';
import {makeSureDirExist} from '../../path';

const DEFAULT_MAX_FILE_COUNT = 100;

/** Format segment for rolled snapshot filenames: `yyyy-MM-dd-hh-mm-ss` (local time, second precision). */
const ROLL_TIMESTAMP_FMT = 'yyyy-MM-dd-hh-mm-ss';

export interface RollingSnapshotWriterOptions {
  dir: string;
  /** Filename only, e.g. `state.json`. Latest snapshot is always `path.join(dir, basename)`. */
  basename: string;
  /** Max number of related snapshot files (including the active `basename`). Default 100. */
  maxFileCount?: number;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Rolling JSON snapshot writer: each `save` persists one object to a file.
 * Latest snapshot lives at `path.join(dir, basename)`.
 * On each save, if that file already exists it is renamed to `name + yyyy-MM-dd-hh-mm-ss + ext`,
 * with `-index` before `ext` if that name exists. When the number of related files exceeds `maxFileCount`,
 * the oldest files (by mtime) are removed, never deleting the active `basename` while it is the current slot.
 */
export class RollingSnapshotWriter {
  private readonly dir: string;
  readonly basename: string;
  private readonly maxFileCount: number;
  readonly basePath: string;
  private chain: Promise<void> = Promise.resolve();

  constructor(options: RollingSnapshotWriterOptions) {
    const {dir, basename, maxFileCount = DEFAULT_MAX_FILE_COUNT} = options;
    this.dir = path.resolve(dir);
    this.basename = basename;
    this.basePath = path.join(this.dir, basename);
    this.maxFileCount = Math.max(1, maxFileCount);
  }

  private bareNameAndExt(): {name: string; ext: string} {
    const {name, ext} = path.parse(this.basename);
    return {name, ext};
  }

  /** Rolled path: `name` + `ts` + `ext`; collision → `name` + `ts` + `-` + index + `ext`. */
  private allocateArchivePath(tsStr: string): string {
    const {name, ext} = this.bareNameAndExt();
    const primary = path.join(this.dir, `${name}${tsStr}${ext}`);
    if (!fs.existsSync(primary)) {
      return primary;
    }
    let i = 1;
    for (;;) {
      const candidate = path.join(this.dir, `${name}${tsStr}-${i}${ext}`);
      if (!fs.existsSync(candidate)) {
        return candidate;
      }
      i += 1;
    }
  }

  /** Match rolled snapshot files (not the active filename). */
  private archiveNamePattern(): RegExp {
    const {name, ext} = this.bareNameAndExt();
    return new RegExp(
      `^${escapeRegex(name)}\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2}(-\\d+)?${escapeRegex(ext)}$`
    );
  }

  private collectRelatedFiles(): {full: string; mtimeMs: number}[] {
    const list: {full: string; mtimeMs: number}[] = [];
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
        list.push({full, mtimeMs: st.mtimeMs});
      } catch {
        /* skip race */
      }
    }
    list.sort((a, b) => a.mtimeMs - b.mtimeMs);
    return list;
  }

  /**
   * Remove oldest related files until at most `maxFileCount` remain.
   * Never deletes the active `basePath`.
   */
  enforceRetention(): void {
    const basePathNorm = path.normalize(this.basePath);
    for (;;) {
      const files = this.collectRelatedFiles();
      if (files.length <= this.maxFileCount) {
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

  private rollExistingActiveFileIfAny(): void {
    if (!fs.existsSync(this.basePath)) {
      return;
    }
    const tsStr = formatDate(new Date(), ROLL_TIMESTAMP_FMT);
    const target = this.allocateArchivePath(tsStr);
    fs.renameSync(this.basePath, target);
  }

  /**
   * Serialize `snapshot` as JSON and write to `path.join(dir, basename)`.
   * If that file already exists, it is renamed first to a second-precision timestamped name.
   * Serializes concurrent saves on this instance.
   */
  save(snapshot: object, cb?: (err?: Error) => void): void {
    this.chain = this.chain
      .then(async () => {
        makeSureDirExist(this.dir);
        this.rollExistingActiveFileIfAny();
        await fs.promises.writeFile(this.basePath, JSON.stringify(snapshot, null, 2), 'utf8');
        this.enforceRetention();
      })
      .then(
        () => {
          cb?.();
        },
        (err: Error) => {
          cb?.(err);
        }
      );
  }

  /** Wait for queued saves to finish (no stream to close). */
  flush(cb?: (err?: Error) => void): void {
    this.chain = this.chain.then(
      () => {
        cb?.();
      },
      (err: Error) => {
        cb?.(err);
      }
    );
  }
}

export function createRollingSnapshotWriter(options: RollingSnapshotWriterOptions): RollingSnapshotWriter {
  return new RollingSnapshotWriter(options);
}
