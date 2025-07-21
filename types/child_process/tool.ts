export interface GitRepoInfo {
  source: Array<{
    /** the remote name of current source */
    origin?: string;
    /** git address */
    url: string;
    /** git branch */
    branch: string;
    /**
     * the commit should be used
     * if commit is provided, action of `git fetch ${remote}` can be avoided, and speed up the whole process.
     */
    commit?: string;
  }>;
  /** path relative to project dir, default value is vendor${vendorKey} */
  relativePath?: string;
  /** The shell command to run in relativePath dir after pull code success, */
  postPullCmds?: Array<string | {cmd: string; throwError?: boolean}>;
  /** some comment on this repo */
  description?: string[];
}

export interface GitRepoInfoTree {
  [repoOrCategoryName: string]: GitRepoInfo | GitRepoInfoTree;
}
