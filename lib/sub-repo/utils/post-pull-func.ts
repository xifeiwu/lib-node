import fs from 'fs';
import path from 'path';
import {SubRepoPostPullFunc} from '../external';

/**
 * Parse .gitmodules file and return list of submodule paths.
 */
function parseGitmodulePaths(gitmodulesPath: string): string[] {
  if (!fs.existsSync(gitmodulesPath)) return [];
  const content = fs.readFileSync(gitmodulesPath, 'utf-8');
  const paths: string[] = [];
  for (const line of content.split('\n')) {
    const match = line.match(/^\s*path\s*=\s*(.+)$/);
    if (match) paths.push(match[1].trim());
  }
  return paths;
}

/**
 * After pulling a subrepo, symlink its git submodules to the root project's
 * git submodules. If the root project doesn't have a matching submodule, throw
 * an error so the user knows to add it.
 */
export const symlinkSubmodules: SubRepoPostPullFunc = async ({
  repoFullPath,
  hostDir,
}: {
  repoFullPath: string;
  hostDir: string;
}) => {
  const subrepoModules = parseGitmodulePaths(path.join(repoFullPath, '.gitmodules'));
  if (subrepoModules.length === 0) return;

  const hostModules = parseGitmodulePaths(path.join(hostDir, '.gitmodules'));

  for (const subPath of subrepoModules) {
    const matchingHostPath = hostModules.find(hp => hp === subPath);
    if (!matchingHostPath) {
      throw new Error(
        `Subrepo submodule "${subPath}" not found in root project.\n` +
          `Please add the corresponding git submodule to the root project first:\n` +
          `  git submodule add <url> ${subPath}`
      );
    }

    const targetAbsPath = path.join(repoFullPath, subPath);
    const hostAbsPath = path.resolve(hostDir, matchingHostPath);
    const symlinkTarget = path.relative(path.dirname(targetAbsPath), hostAbsPath);

    // Remove existing directory/symlink and create symlink
    try {
      const stat = fs.lstatSync(targetAbsPath);
      if (stat) fs.rmSync(targetAbsPath, {recursive: true, force: true});
    } catch {
      // path doesn't exist, nothing to remove
    }
    fs.mkdirSync(path.dirname(targetAbsPath), {recursive: true});
    fs.symlinkSync(symlinkTarget, targetAbsPath);
    console.log(`  Symlinked: ${subPath} → ${symlinkTarget}`);
  }
};
