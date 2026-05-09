import path from 'path';
import {SubRepoConfig, SubRepoInfoTree} from '../external';

export function isSubrepoLeaf(info: SubRepoConfig | SubRepoInfoTree) {
  const {postPullCmds, source} = info as SubRepoConfig;
  return Array.isArray(source) || Array.isArray(postPullCmds);
}

export function asSubrepoLeaf(info: SubRepoConfig | SubRepoInfoTree) {
  return info as SubRepoConfig;
}

export function collectSubrepoRelativePaths(infoTree: SubRepoInfoTree, repoDir: string): string[] {
  const results: string[] = [];
  for (const [repoOrCategoryName, info] of Object.entries(infoTree)) {
    if (isSubrepoLeaf(info)) {
      const {relativePath = path.join(repoDir, repoOrCategoryName)} = asSubrepoLeaf(info);
      results.push(relativePath);
    } else {
      results.push(
        ...collectSubrepoRelativePaths(info as SubRepoInfoTree, path.join(repoDir, repoOrCategoryName))
      );
    }
  }
  return results;
}

function subrepoNameMatches(filterName: string, leafKey: string, relativePath: string): boolean {
  const n = filterName.replace(/\\/g, '/');
  const rp = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return (
    leafKey === filterName ||
    rp === n ||
    rp.endsWith('/' + n) ||
    path.basename(rp) === filterName ||
    path.posix.basename(rp) === filterName
  );
}

/** Keep only leaves that match `repoName` (key, relative path, or basename). Categories are kept if any descendant matches. */
export function filterSubrepoTreeByRepoName(
  tree: SubRepoInfoTree,
  repoDir: string,
  repoName: string
): SubRepoInfoTree {
  const out: SubRepoInfoTree = {};
  for (const [key, info] of Object.entries(tree)) {
    if (isSubrepoLeaf(info)) {
      const rel = asSubrepoLeaf(info).relativePath ?? path.join(repoDir, key);
      if (subrepoNameMatches(repoName, key, rel)) {
        out[key] = info;
      }
    } else {
      const nested = filterSubrepoTreeByRepoName(info as SubRepoInfoTree, path.join(repoDir, key), repoName);
      if (Object.keys(nested).length > 0) {
        out[key] = nested;
      }
    }
  }
  return out;
}

export function assertNonEmptySubrepoTree(tree: SubRepoInfoTree, label: string) {
  if (Object.keys(tree).length === 0) {
    throw new Error(`${label}: subrepo tree is empty`);
  }
}
