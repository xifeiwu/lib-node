import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {logColorful} from '../../log';
import {goOnOrNot} from '../../readline';

/**
 * Feature of run diff command in execSync:
 * if content of two dir is the same, $? from shell is 0, return ''
 * else $? is 1, execSync will throw error, the diff result is in err.stdout
 */
export function diffDir(dir1: string, dir2: string): string {
  const dirNotExist = [dir1, dir2].find(it => !fs.existsSync(it));
  if (dirNotExist) {
    throw new Error(`dir not exist: ${dirNotExist}`);
  }
  try {
    logColorful({color: 'yellow'}, `diff -uNra ${dir1} ${dir2}`);
    const diff = execSync(`diff -uNra ${dir1} ${dir2}`, {encoding: 'utf-8', maxBuffer: 1024 * 1024 * 128});
    return diff;
  } catch (err: any) {
    if (err.status === 1) {
      return err.stdout.toString();
    } else {
      throw new Error('diff command failed:' + err.stderr?.toString() || err.message);
    }
  }
}

/**
 * sync up content of dir ${from} to dir ${to}
 * diff = to - from
 * path = diff + from, apply diff to from
 * @param from, the dir refer to
 * @param to, the dir to apply patch
 */
export async function syncupDirContentByDiff(from: string, to: string) {
  /** diff folder using absolute path */
  from = path.resolve(from);
  to = path.resolve(to);
  if (!fs.existsSync(from)) {
    throw new Error(`original folder not found: ${from}`);
  }
  if (
    !fs.existsSync(to) &&
    (await goOnOrNot({
      tips: [`Folder not exist, will create it`, to + '?'],
    }))
  ) {
    fs.mkdirSync(to);
  }
  const diff = await diffDir(to, from);
  if (diff === '') {
    logColorful({color: 'yellow'}, `The content of two dir is the same.`);
    return;
  }
  logColorful({color: 'yellow'}, 'Content of diff:');
  const toPathParts = to.split('/');
  const fromPathParts = from.split('/');
  const index = toPathParts.findIndex((it, index) => {
    return it !== fromPathParts[index];
  });
  const patchDir = toPathParts.slice(0, index + 1).join('/');
  const dirDepth = index + 1;
  logColorful({}, diff);
  if (
    !(await goOnOrNot({
      tips: [
        `This is the diff between`,
        to,
        'and',
        from,
        `will apply to dir ${patchDir}`,
        `will you apply these diff?`,
      ],
      defaultValue: true,
    }))
  ) {
    return;
  }
  try {
    execSync(`patch -d ${patchDir} -p${dirDepth}`, {input: diff, encoding: 'utf-8'});
  } catch (error) {
    const {stdout, stderr, message} = error;
    const out = stdout?.toString();
    const err = stderr?.toString();
    logColorful({}, out, err, message);
  }
}
