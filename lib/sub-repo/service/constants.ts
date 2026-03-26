/** Default subrepo manifest filenames (relative to host project root), first match wins. */
export const SUBREPO_CONFIG_CANDIDATES = [
  'sub-repo.ts',
  'sub-repo.js',
  'sub-repo/index.ts',
  'sub-repo/index.js',
] as const;
