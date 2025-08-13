/**
 * For easy management of submodule, compared to git submodule, manager submodule projects by this script have benefits:
 * 1. Easy to add or remove a vendor, if don't want to track the submodule, just remove the dir and related config in the following
 * 2. Not blocked by network issue when can't not loading distinct submodule
 * 3. Can manage  vendor in different version if necessary, such axios, axios-v0
 */
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
  postPullCmds?: Array<Function | string | {cmd: string; ignoreStatus?: number[]}>;
  /** some comment on this repo */
  description?: string[];
}

export interface GitRepoInfoTree {
  [repoOrCategoryName: string]: GitRepoInfo | GitRepoInfoTree;
}
