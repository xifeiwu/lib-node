/**
 * For easy management of submodule, compared to git submodule, manager submodule projects by this script have benefits:
 * 1. Easy to add or remove a vendor, if don't want to track the submodule, just remove the dir and related config in the following
 * 2. Not blocked by network issue when can't not loading distinct submodule
 * 3. Can manage  vendor in different version if necessary, such axios, axios-v0
 */
import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import {logColorful, GitRepoInfo} from '../..';
import {isString} from '../../external';

function execSyncAndLog(cmd: string, options?: {throwError?: boolean}) {
  const {throwError = true} = options ?? {};
  logColorful({color: 'black'}, cmd);
  try {
    const result = cp.execSync(cmd);
    return result;
  } catch (err) {
    const {stack, message} = err;
    if (throwError) {
      logColorful({color: 'red'}, process.cwd(), stack ?? message);
      throw err;
    }
  }
}

function getCurrentBranch() {
  return execSyncAndLog(`git branch --show-current`).toString().trim();
}
function getAllLocalBranches() {
  return execSyncAndLog(`git for-each-ref --format='%(refname:short)' refs/heads/`)
    .toString()
    .split('\n')
    .map(it => it.trim())
    .filter(it => it);
  // .map(it => it.substring(2));
}
function getCurrentCommitId() {
  return execSyncAndLog('git rev-parse HEAD').toString().trim();
}
interface SyncupGitRepoConfig {
  hostDir: string;
  /** which dir of hostDir used to locate git repo */
  repoDir: string;
}
export async function syncUpGitRepos(gitRepos: {[key: string]: GitRepoInfo}, config: SyncupGitRepoConfig) {
  const {hostDir, repoDir = ''} = config;
  let index = 0;
  for (const [repoName, config] of Object.entries(gitRepos)) {
    logColorful({color: 'yellow'}, `${++index}. handing repo ${repoName}`);
    process.chdir(hostDir);
    const {
      source: [{url, remote = 'origin', branch, commit}],
      relativePath = path.join(repoDir, repoName),
      postPullCmds = [],
    } = config;
    const fullPath = path.resolve(hostDir, relativePath);
    /**
     * 1. Check repo dir, clone repo if not exist
     */
    if (!fs.existsSync(fullPath)) {
      // fs.mkdirSync(relativePath, {recursive: true});
      execSyncAndLog(`git clone ${url} ${relativePath}`);
    }
    process.chdir(fullPath);
    /**
     * 2. Check branch, make sure in target branch
     */
    const curBranch = getCurrentBranch();
    if (curBranch !== branch) {
      const allBranchs = getAllLocalBranches();
      const isBranchExist = allBranchs.includes(branch);
      if (!isBranchExist) {
        execSyncAndLog(`git checkout -b ${branch}`);
      } else {
        execSyncAndLog(`git checkout ${branch}`);
      }
    }
    /**
     * 3. Align with target commit id if provided, else make sure target branch is not stale
     */
    const curCommitId = getCurrentCommitId();
    if (commit !== undefined && commit !== curCommitId) {
      /** check whether target commit is in current branch */
      try {
        /** List branches that contain the commit */
        execSyncAndLog(`git branch --contain=${commit}`);
      } catch (err) {
        execSyncAndLog(`git fetch ${remote}`);
        // execSyncAndLog(`git reset --hard ${remote}/${branch}`);
      }
      /** Align with target commit */
      try {
        execSyncAndLog(`git reset --hard ${commit}`);
      } catch (err) {
        throw new Error(`commit id: ${commit} not contained in branch ${branch}`);
      }
    } else {
      /** Align target branch with remote */
      execSyncAndLog(`git fetch ${remote}`);
      execSyncAndLog(`git reset --hard ${remote}/${branch}`);
    }
    for (const command of postPullCmds) {
      if (isString(command)) {
        execSyncAndLog(command as string);
      } else {
        const {cmd, throwError} = command as {cmd: string; throwError?: boolean};
        execSyncAndLog(cmd, {throwError});
      }
    }
    // const currentBranch = execSync(`git rev-parse --abbrev-ref HEAD`).toString().trim();
  }
}

export function writeGitIgnoreFile(gitRepos: {[key: string]: GitRepoInfo}, config: SyncupGitRepoConfig) {
  const {hostDir, repoDir} = config;
  process.chdir(hostDir);
  const rules = ['.DS_Store', 'node_modules/']
    .concat(
      Object.entries(gitRepos).map(([repoName, repoConfig]) => {
        const {relativePath = path.join(repoDir, repoName)} = repoConfig;
        return relativePath;
      })
    )
    .join('\n');
  fs.writeFileSync(path.resolve(hostDir, '.gitignore'), rules);
}
