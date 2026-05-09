/**
 * Nested git repos (subrepos) vs git submodule: easier add/remove, optional network isolation, version variants per folder.
 */
import fs from 'fs';
import path from 'path';
import {
  defaultGitExecOptions,
  execCmdWithOptions,
  getGitCurrentBranch,
  getGitHeadCommit,
  goOnOrNot,
  isFunction,
  isString,
  listGitLocalBranches,
  logColorful,
  SubRepoPostPullFunc,
  SubRepoConfigFileExport,
  SubRepoInfoTree,
} from './external';
import {
  assertNonEmptySubrepoTree,
  collectSubrepoRelativePaths,
  filterSubrepoTreeByRepoName,
  isSubrepoLeaf,
  asSubrepoLeaf,
} from './service/tree';
import {resolveSubrepoConfigFile} from './service/config';

/**
 * info passed during incrementally syncSubrepos
 */
export interface SubrepoSyncConfig {
  hostDir: string;
  /** the relative path of hostDir that host vendor projects */
  repoBaseDir: string;
  index?: number;
}

/**
 * incrementally sync subrepos in a tree structure
 * @param subrepos
 * @param config
 */
async function syncSubrepos(subrepos: SubRepoInfoTree, config: SubrepoSyncConfig) {
  const {hostDir, repoBaseDir: repoDir = '', index: mainIndex} = config;
  const indexPrefix = mainIndex !== undefined ? mainIndex + '.' : '';
  let index = 0;
  const execOpts = defaultGitExecOptions;
  for (const [repoOrCategoryName, info] of Object.entries(subrepos)) {
    process.chdir(hostDir);
    if (!isSubrepoLeaf(info)) {
      await syncSubrepos(info as SubRepoInfoTree, {
        hostDir,
        repoBaseDir: path.join(repoDir, repoOrCategoryName),
        index,
      });
      continue;
    }
    const {
      source = [],
      /** calculate relativePath if it's not set */
      relativePath = path.join(repoDir, repoOrCategoryName),
      postPullCmds = [],
    } = asSubrepoLeaf(info);
    logColorful({color: 'yellow'}, `${indexPrefix}${++index}. handing repo ${relativePath}`);
    const repoFullPath = path.resolve(hostDir, relativePath);
    const runPostPullCmds = async () => {
      if (postPullCmds.length === 0) {
        return;
      }
      if (!fs.existsSync(repoFullPath)) {
        fs.mkdirSync(repoFullPath, {recursive: true});
      } else if (!fs.statSync(repoFullPath).isDirectory()) {
        throw new Error(`is not a dir: ${repoFullPath}`);
      }
      process.chdir(repoFullPath);
      for (const command of postPullCmds) {
        if (isFunction(command)) {
          await (command as SubRepoPostPullFunc)({repoFullPath, hostDir});
        } else if (isString(command)) {
          execCmdWithOptions(command as string, execOpts);
        } else {
          const {cmd, ...options} = command as {cmd: string; ignoreStatus?: number[]};
          execCmdWithOptions(cmd, {...execOpts, ...options});
        }
      }
    };
    const [mainSource] = source;
    if (!mainSource) {
      await runPostPullCmds();
      continue;
    }
    const {url, origin = 'origin', branch, commit} = mainSource;
    if (!fs.existsSync(repoFullPath)) {
      for (let i = 0; i < source.length; i++) {
        if (i === 0) {
          execCmdWithOptions(`git clone -o ${origin} -b ${branch} ${url} ${relativePath}`, execOpts);
        } else {
          const it = source[i];
          if (!it.origin) {
            continue;
          }
          execCmdWithOptions(`git remote add -t ${it.branch} ${it.origin} ${it.url}`, execOpts);
        }
      }
    } else if (!fs.statSync(repoFullPath).isDirectory()) {
      throw new Error(`is not a dir: ${repoFullPath}`);
    }

    process.chdir(repoFullPath);
    if (!fs.existsSync(path.join(repoFullPath, '.git'))) {
      execCmdWithOptions(`git init`, execOpts);
      execCmdWithOptions(`git remote add -t ${branch} ${origin} ${url}`, execOpts);
      for (let i = 1; i < source.length; i++) {
        const it = source[i];
        if (!it.origin) {
          continue;
        }
        execCmdWithOptions(`git remote add -t ${it.branch} ${it.origin} ${it.url}`, execOpts);
      }
    }
    try {
      execCmdWithOptions(`git remote get-url ${origin}`, execOpts);
    } catch {
      execCmdWithOptions(`git remote add -t ${branch} ${origin} ${url}`, execOpts);
    }
    const curBranch = getGitCurrentBranch(execOpts);
    if (curBranch !== branch) {
      const allBranchs = listGitLocalBranches(execOpts);
      const isBranchExist = allBranchs.includes(branch);
      if (!isBranchExist) {
        execCmdWithOptions(`git checkout -b ${branch}`, execOpts);
      } else {
        execCmdWithOptions(`git checkout ${branch}`, execOpts);
      }
    }
    let curCommitId: string | undefined;
    try {
      curCommitId = getGitHeadCommit(execOpts);
    } catch {}
    if (commit !== undefined) {
      if (commit !== curCommitId) {
        try {
          execCmdWithOptions(`git branch --contain=${commit}`, execOpts);
        } catch {
          execCmdWithOptions(`git fetch ${origin}`, execOpts);
        }
        try {
          execCmdWithOptions(`git reset --hard ${commit}`, execOpts);
        } catch {
          throw new Error(`commit id: ${commit} not contained in branch ${branch}`);
        }
      }
    } else {
      execCmdWithOptions(`git fetch ${origin}`, execOpts);
      execCmdWithOptions(`git reset --hard ${origin}/${branch}`, execOpts);
    }
    await runPostPullCmds();
  }
}

function writeSubrepoGitIgnore(subrepos: SubRepoInfoTree, config: SubrepoSyncConfig) {
  const {hostDir, repoBaseDir: repoDir = ''} = config;
  const gitIgnoreFile = path.resolve(hostDir, '.gitignore');
  let newRules = ['.DS_Store', 'node_modules/', ...collectSubrepoRelativePaths(subrepos, repoDir)].filter(
    Boolean
  );
  if (fs.existsSync(gitIgnoreFile)) {
    const lines = fs.readFileSync(gitIgnoreFile).toString().split('\n').filter(Boolean);
    newRules = Array.from(new Set([...newRules, ...lines]));
  }
  fs.writeFileSync(gitIgnoreFile, newRules.join('\n'));
}

export interface SyncSubreposFromWorkspaceOptions {
  dir: string;
  repoFileName?: string;
  /** If set, only sync leaves whose key or relative path matches (basename or full path segment). */
  repoName?: string;
}

export async function syncSubreposFromWorkspace(options: SyncSubreposFromWorkspaceOptions) {
  const {dir: hostDir, repoFileName, repoName} = options;
  if (!fs.existsSync(hostDir)) {
    throw new Error(`dir not exist: ${hostDir}`);
  }
  if (!fs.statSync(hostDir).isDirectory()) {
    throw new Error(`is not a dir: ${hostDir}`);
  }
  process.chdir(hostDir);
  const repoConfigFile = resolveSubrepoConfigFile(hostDir, repoFileName);
  const {repoInfoTree, repoBaseDir: repoDir = ''} = require(repoConfigFile) as SubRepoConfigFileExport;
  assertNonEmptySubrepoTree(repoInfoTree, 'subrepo config');

  if (repoDir !== '' && (!fs.existsSync(repoDir) || !fs.statSync(repoDir).isDirectory())) {
    throw new Error(`dir not exist: ${repoDir}`);
  }

  let treeToSync = repoInfoTree;
  if (repoName !== undefined && repoName !== '') {
    treeToSync = filterSubrepoTreeByRepoName(repoInfoTree, repoDir, repoName);
    if (Object.keys(treeToSync).length === 0) {
      throw new Error(`No subrepo matched name: ${JSON.stringify(repoName)}`);
    }
  }

  if (
    !(await goOnOrNot({
      tips: [
        {
          content: {
            configFile: repoConfigFile,
            hostDir,
            repoDir,
            repoName: repoName || '(all)',
            syncScope: repoName ? 'filtered' : 'all',
          },
        },
        'Will run command using config above?',
      ],
      defaultValue: true,
    }))
  ) {
    return;
  }
  await syncSubrepos(treeToSync, {
    hostDir,
    repoBaseDir: repoDir,
  });
  writeSubrepoGitIgnore(repoInfoTree, {
    hostDir,
    repoBaseDir: repoDir,
  });
}
