import {ExecCmdOptions} from '../types';
import {execCmdWithOptions} from '../child-process';

export const defaultGitExecOptions: ExecCmdOptions = {
  more: {
    log: true,
  },
};

export function getGitCurrentBranch(options: ExecCmdOptions = defaultGitExecOptions): string {
  return execCmdWithOptions(`git branch --show-current`, options).toString().trim();
}

export function listGitLocalBranches(options: ExecCmdOptions = defaultGitExecOptions): string[] {
  return execCmdWithOptions(`git for-each-ref --format='%(refname:short)' refs/heads/`, options)
    .toString()
    .split('\n')
    .map(it => it.trim())
    .filter(it => it);
}

export function getGitHeadCommit(options: ExecCmdOptions = defaultGitExecOptions): string {
  return execCmdWithOptions('git rev-parse HEAD', options).toString().trim();
}
