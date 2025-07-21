/**
 * For easy management of submodule, compared to git submodule, manager submodule projects by this script have benefits:
 * 1. Easy to add or remove a vendor, if don't want to track the submodule, just remove the dir and related config in the following
 * 2. Not blocked by network issue when can't not loading distinct submodule
 * 3. Can manage  vendor in different version if necessary, such axios, axios-v0
 */
import cp from 'child_process';
import fs from 'fs';
import path from 'path';
import {GitRepoInfo, GitRepoInfoTree} from '../types';
import {isString} from '../external';
import {logColorful} from '../log';

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

function isGitRepoInfo(info: GitRepoInfo | GitRepoInfoTree) {
  return (info as GitRepoInfo).source !== undefined;
}
function toGitRepoInfo(info: GitRepoInfo | GitRepoInfoTree) {
  return info as GitRepoInfo;
}
interface SyncupGitRepoConfig {
  hostDir: string;
  /** the relative path of hostDir that host vendor projects */
  repoDir: string;
  index?: number;
}
export async function syncUpGitRepos(gitRepos: GitRepoInfoTree, config: SyncupGitRepoConfig) {
  const {hostDir, repoDir = '', index: mainIndex} = config;
  const indexPrefix = mainIndex !== undefined ? mainIndex + '.' : '';
  let index = 0;
  for (const [repoOrCategoryName, info] of Object.entries(gitRepos)) {
    logColorful({color: 'yellow'}, `${indexPrefix}${++index}. handing repo ${repoDir}/${repoOrCategoryName}`);
    process.chdir(hostDir);
    if (!isGitRepoInfo(info)) {
      await syncUpGitRepos(info as GitRepoInfoTree, {
        hostDir,
        repoDir: path.join(repoDir, repoOrCategoryName),
        index,
      });
      continue;
    }
    const {
      source,
      relativePath = path.join(repoDir, repoOrCategoryName),
      postPullCmds = [],
    } = toGitRepoInfo(info);
    const [mainSource] = source;
    if (!mainSource) {
      throw new Error(`At least one source should be set`);
    }
    const {url, origin = 'origin', branch, commit} = mainSource;
    const fullPath = path.resolve(hostDir, relativePath);
    /**
     * 1. Check repo dir, clone repo if not exist
     */
    if (!fs.existsSync(fullPath)) {
      // fs.mkdirSync(relativePath, {recursive: true});
      for (let i = 0; i < source.length; i++) {
        if (i === 0) {
          execSyncAndLog(`git clone -o ${origin} -b ${branch} ${url} ${relativePath}`);
        } else {
          const it = source[i];
          if (!it.origin) {
            continue;
          }
          execSyncAndLog(`git remote add -t ${it.branch} ${it.origin} ${it.url}`);
        }
      }
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
    if (commit !== undefined) {
      if (commit !== curCommitId) {
        /** check whether target commit is in current branch */
        try {
          /** List branches that contain the commit */
          execSyncAndLog(`git branch --contain=${commit}`);
        } catch (err) {
          execSyncAndLog(`git fetch ${origin}`);
          // execSyncAndLog(`git reset --hard ${remote}/${branch}`);
        }
        /** Align with target commit */
        try {
          execSyncAndLog(`git reset --hard ${commit}`);
        } catch (err) {
          throw new Error(`commit id: ${commit} not contained in branch ${branch}`);
        }
      }
    } else {
      /** Align target branch with remote */
      execSyncAndLog(`git fetch ${origin}`);
      execSyncAndLog(`git reset --hard ${origin}/${branch}`);
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

export function writeGitIgnoreFile(gitRepos: GitRepoInfoTree, config: SyncupGitRepoConfig) {
  const {hostDir, repoDir = ''} = config;
  function getRepoRelativePath(infoTree: GitRepoInfoTree, config: Pick<SyncupGitRepoConfig, 'repoDir'>) {
    const {repoDir} = config;
    const results: string[] = [];
    for (const [repoOrCategoryName, info] of Object.entries(infoTree)) {
      if (isGitRepoInfo(info)) {
        const {relativePath = path.join(repoDir, repoOrCategoryName)} = toGitRepoInfo(info);
        results.push(relativePath);
      } else {
        results.push(
          ...getRepoRelativePath(info as GitRepoInfoTree, {
            repoDir: path.join(repoDir, repoOrCategoryName),
          })
        );
      }
    }
    return results;
  }
  const gitIgnoreFile = path.resolve(hostDir, '.gitignore');
  let newRules = ['.DS_Store', 'node_modules/', repoDir, ...getRepoRelativePath(gitRepos, {repoDir})].filter(
    Boolean
  );
  if (fs.existsSync(gitIgnoreFile)) {
    const lines = fs.readFileSync(gitIgnoreFile).toString().split('\n').filter(Boolean);
    newRules = Array.from(new Set([...newRules, ...lines]));
  }
  fs.writeFileSync(gitIgnoreFile, newRules.join('\n'));
}
