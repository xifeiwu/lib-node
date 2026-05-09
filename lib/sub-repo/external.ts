/** Re-exports of symbols this package uses from outside `sub-repo/`. */
export {
  isFunction,
  isString,
  SubRepoConfig,
  SubRepoConfigFileExport,
  SubRepoInfoTree,
  SubRepoPostPullFunc,
  isObject,
} from '../../external';
export {logColorful} from '../../log';
export {execCmdWithOptions} from '../../child-process';
export {goOnOrNot} from '../../readline';
export {
  defaultGitExecOptions,
  getGitCurrentBranch,
  getGitHeadCommit,
  listGitLocalBranches,
} from '../../utils/git';
