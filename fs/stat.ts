import {execSync} from 'child_process';
import fs, {TimeLike} from 'fs';
import {toDtStr} from '../external';

/**
 * Set creation time (birthtime) on macOS using Apple's SetFile (Xcode CLI).
 * Only works on darwin when SetFile is installed. No-op otherwise.
 */
function setCreationTimeMac(fullPath: string, date: TimeLike): boolean {
  if (process.platform !== 'darwin') {
    return false;
  }
  try {
    // SetFile -d "MM/DD/YYYY HH:MM:SS" file
    //   'yyyy-MM-ddThh:mm:ss.SSSz'
    const dtStr = toDtStr(date, 'MM/dd/yyyy hh:mm:ss');
    execSync(`SetFile -d "${dtStr}" ${JSON.stringify(fullPath)}`, {stdio: 'pipe'});
    return true;
  } catch {
    return false;
  }
}

/**
 * Set both mtime and (on macOS) birthtime from EXIF original date.
 * Use after copying photos from iPhone so create/modify time match the shot.
 */
export async function updateFileTimes(
  fullPath: string,
  options?: {time?: TimeLike; atime?: TimeLike; mtime?: TimeLike; birthtime?: TimeLike}
): Promise<boolean> {
  if (!fs.existsSync(fullPath)) {
    throw new Error(`File not exist: ${fullPath}`);
  }
  const {atime, mtime, birthtime} = fs.statSync(fullPath);
  const newAtime = options?.atime ?? atime;
  const newMtime = options?.mtime ?? options?.time;
  const newBirthtime = options?.birthtime ?? options?.time;
  let changed = false;

  const needUpdateTime = newMtime !== undefined && new Date(newMtime).getTime() !== mtime.getTime();
  if (needUpdateTime) {
    fs.utimesSync(fullPath, newAtime ?? atime, newMtime ?? mtime);
    changed = true;
  }
  if (newBirthtime && birthtime.getTime() !== new Date(newBirthtime).getTime()) {
    setCreationTimeMac(fullPath, newBirthtime);
    changed = true;
  }
  return changed;
}
