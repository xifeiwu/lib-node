import {syncUpGitReposByDir} from './git';

export async function testSyncUpGitReposByDir() {
  const dir = '/Users/wuxifei/code/react/start/small-apps-wrapper';
  await syncUpGitReposByDir({dir});
}
