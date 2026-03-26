import fs from 'fs';
import path from 'path';
import {SubRepoConfigFileExport} from '../external';
import {SUBREPO_CONFIG_CANDIDATES} from './constants';
import {assertNonEmptySubrepoTree, collectSubrepoRelativePaths} from './tree';

export function resolveSubrepoConfigFile(hostDir: string, repoFileName?: string): string {
  const fileNames = [repoFileName, ...SUBREPO_CONFIG_CANDIDATES].filter(Boolean) as string[];
  const repoConfigFile = fileNames.map(p => path.resolve(hostDir, p)).find(it => fs.existsSync(it));
  if (!repoConfigFile) {
    throw new Error(
      `Not found subrepo config in ${hostDir}: [${[...(repoFileName ? [repoFileName] : []), ...SUBREPO_CONFIG_CANDIDATES].map(s => JSON.stringify(s)).join(', ')}]`
    );
  }
  return repoConfigFile;
}

export interface SubrepoConfigSummary {
  configFile: string;
  hostDir: string;
  repoDir?: string;
  subrepoRelativePaths: string[];
}

export function getSubrepoConfigSummary(hostDir: string, repoFileName?: string): SubrepoConfigSummary {
  if (!fs.existsSync(hostDir)) {
    throw new Error(`dir not exist: ${hostDir}`);
  }
  if (!fs.statSync(hostDir).isDirectory()) {
    throw new Error(`is not a dir: ${hostDir}`);
  }
  const configFile = resolveSubrepoConfigFile(hostDir, repoFileName);
  const prevCwd = process.cwd();
  process.chdir(hostDir);
  try {
    const {repoInfoTree, repoBaseDir = ''} = require(configFile) as SubRepoConfigFileExport;
    assertNonEmptySubrepoTree(repoInfoTree, 'subrepo config');
    if (repoBaseDir !== '' && (!fs.existsSync(repoBaseDir) || !fs.statSync(repoBaseDir).isDirectory())) {
      throw new Error(`repoBaseDir: ${repoBaseDir} in hostDir: ${hostDir}`);
    }
    const subrepoRelativePaths = collectSubrepoRelativePaths(repoInfoTree, repoBaseDir);
    return {
      configFile,
      hostDir: path.resolve(hostDir),
      repoDir: repoBaseDir || undefined,
      subrepoRelativePaths,
    };
  } finally {
    process.chdir(prevCwd);
  }
}

export function printSubrepoConfig(hostDir: string, repoFileName?: string): void {
  const summary = getSubrepoConfigSummary(hostDir, repoFileName);
  console.log(
    JSON.stringify(
      {
        configFile: summary.configFile,
        hostDir: summary.hostDir,
        repoDir: summary.repoDir,
        subrepos: summary.subrepoRelativePaths,
      },
      null,
      2
    )
  );
}
