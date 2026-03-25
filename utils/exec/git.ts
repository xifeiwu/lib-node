/**
 * For easy management of submodule, compared to git submodule, manager submodule projects by this script have benefits:
 * 1. Easy to add or remove a vendor, if don't want to track the submodule, just remove the dir and related config in the following
 * 2. Not blocked by network issue when can't not loading distinct submodule
 * 3. Can manage  vendor in different version if necessary, such axios, axios-v0
 */
import fs from 'fs';
import path from 'path';
import {ExecCmdOptions} from '../../types';
import {isFunction, isString, GitRepoInfo, GitRepoInfoTree, GitRepoConfigFileExport} from '../../external';
import {logColorful} from '../../log';
import {execCmdWithOptions} from '../../child-process';
import {goOnOrNot} from '../../readline';

const DEFAULT_EXEC_OPTIONS: ExecCmdOptions = {
  log: true,
};

function getCurrentBranch() {
  return execCmdWithOptions(`git branch --show-current`, DEFAULT_EXEC_OPTIONS).toString().trim();
}
function getAllLocalBranches() {
  return execCmdWithOptions(`git for-each-ref --format='%(refname:short)' refs/heads/`, DEFAULT_EXEC_OPTIONS)
    .toString()
    .split('\n')
    .map(it => it.trim())
    .filter(it => it);
  // .map(it => it.substring(2));
}
function getCurrentCommitId() {
  return execCmdWithOptions('git rev-parse HEAD', DEFAULT_EXEC_OPTIONS).toString().trim();
}

function isGitRepoInfo(info: GitRepoInfo | GitRepoInfoTree) {
  const {source} = info as GitRepoInfo;
  return source !== undefined && Array.isArray(source);
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
      /** calculate relativePath if it's not set */
      relativePath = path.join(repoDir, repoOrCategoryName),
      postPullCmds = [],
    } = toGitRepoInfo(info);
    logColorful({color: 'yellow'}, `${indexPrefix}${++index}. handing repo ${relativePath}`);
    const [mainSource] = source;
    if (!mainSource) {
      throw new Error(`At least one source should be set`);
    }
    const {url, origin = 'origin', branch, commit} = mainSource;
    const repoFullPath = path.resolve(hostDir, relativePath);
    /**
     * 1. Check repo dir, clone repo if not exist
     */
    if (!fs.existsSync(repoFullPath)) {
      // fs.mkdirSync(relativePath, {recursive: true});
      for (let i = 0; i < source.length; i++) {
        if (i === 0) {
          execCmdWithOptions(
            `git clone -o ${origin} -b ${branch} ${url} ${relativePath}`,
            DEFAULT_EXEC_OPTIONS
          );
        } else {
          const it = source[i];
          if (!it.origin) {
            continue;
          }
          execCmdWithOptions(`git remote add -t ${it.branch} ${it.origin} ${it.url}`, DEFAULT_EXEC_OPTIONS);
        }
      }
    }
    process.chdir(repoFullPath);
    /**
     * 2. Check branch, make sure in target branch
     */
    const curBranch = getCurrentBranch();
    if (curBranch !== branch) {
      const allBranchs = getAllLocalBranches();
      const isBranchExist = allBranchs.includes(branch);
      if (!isBranchExist) {
        execCmdWithOptions(`git checkout -b ${branch}`, DEFAULT_EXEC_OPTIONS);
      } else {
        execCmdWithOptions(`git checkout ${branch}`, DEFAULT_EXEC_OPTIONS);
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
          execCmdWithOptions(`git branch --contain=${commit}`, DEFAULT_EXEC_OPTIONS);
        } catch (err) {
          execCmdWithOptions(`git fetch ${origin}`, DEFAULT_EXEC_OPTIONS);
          // execSyncAndLog(`git reset --hard ${remote}/${branch}`);
        }
        /** Align with target commit */
        try {
          execCmdWithOptions(`git reset --hard ${commit}`, DEFAULT_EXEC_OPTIONS);
        } catch (err) {
          throw new Error(`commit id: ${commit} not contained in branch ${branch}`);
        }
      }
    } else {
      /** Align target branch with remote */
      execCmdWithOptions(`git fetch ${origin}`, DEFAULT_EXEC_OPTIONS);
      execCmdWithOptions(`git reset --hard ${origin}/${branch}`, DEFAULT_EXEC_OPTIONS);
    }
    for (const command of postPullCmds) {
      if (isFunction(command)) {
        await (command as Function)({repoFullPath});
      } else if (isString(command)) {
        execCmdWithOptions(command as string, DEFAULT_EXEC_OPTIONS);
      } else {
        const {cmd, ...options} = command as {cmd: string; ignoreStatus?: number[]};
        execCmdWithOptions(cmd, {...DEFAULT_EXEC_OPTIONS, ...options});
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
  let newRules = ['.DS_Store', 'node_modules/', ...getRepoRelativePath(gitRepos, {repoDir})].filter(Boolean);
  if (fs.existsSync(gitIgnoreFile)) {
    const lines = fs.readFileSync(gitIgnoreFile).toString().split('\n').filter(Boolean);
    newRules = Array.from(new Set([...newRules, ...lines]));
  }
  fs.writeFileSync(gitIgnoreFile, newRules.join('\n'));
}

export async function syncUpGitReposByDir(config: {dir: string; repoFileName?: string}) {
  const {dir: hostDir, repoFileName} = config;
  if (!fs.existsSync(hostDir)) {
    throw new Error(`dir not exist: ${hostDir}`);
  }
  if (!fs.statSync(hostDir).isDirectory()) {
    throw new Error(`is not a dir: ${hostDir}`);
  }
  process.chdir(hostDir);
  const fileNames = [
    repoFileName,
    'gitmodules.ts',
    'gitmodules.js',
    'gitmodules/index.ts',
    'gitmodules/index.js',
    'gitmodules.json',
  ].filter(Boolean);
  const repoConfigFile = fileNames.map(p => path.resolve(hostDir, p)).find(it => fs.existsSync(it));
  if (!repoConfigFile) {
    throw new Error(
      `Not found git modules config file in current work dir: ['gitmodules.ts', 'gitmodules.js', 'gitmodules.json']`
    );
  }
  const {repoInfoTree, repoDir = ''} = require(repoConfigFile) as GitRepoConfigFileExport;
  for (const dir of [hostDir, repoDir]) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
      throw new Error(`dir not exist: ${dir}`);
    }
  }
  if (
    !(await goOnOrNot({
      tips: [
        {
          content: {configFile: repoConfigFile, hostDir, repoDir},
        },
        'Will run command using config above?',
      ],
      defaultValue: true,
    }))
  ) {
    return;
  }
  await syncUpGitRepos(repoInfoTree, {
    hostDir,
    repoDir,
  });
  writeGitIgnoreFile(repoInfoTree, {
    hostDir,
    repoDir,
  });
}
