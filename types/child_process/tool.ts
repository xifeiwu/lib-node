export interface GitRepoInfo {
  source: Array<{
    /** git address */
    url: string;
    /** default orign */
    remote?: string;
    /** git branch */
    branch: string;
    /** the commit should be used */
    commit?: string;
  }>;
  /** path relative to project dir, default value is vendor${vendorKey} */
  relativePath?: string;
  /** The shell command to run in relativePath dir after pull code success, */
  postPullCmds?: Array<string | {cmd: string; throwError?: boolean}>;
  /** some comment on this repo */
  description?: string[];
  /** It is a sub module of another vendor */
  moduleOf?: string[];
}
