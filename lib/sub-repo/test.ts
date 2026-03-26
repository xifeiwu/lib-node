import { getSubrepoConfigSummary } from "./service/config";
import { syncSubreposFromWorkspace } from "./sync";

export async function testGetSubrepoConfigSummary() {
  const dir = '/Users/wuxifei/code/react/start/small-apps-wrapper';
  const configSummary = getSubrepoConfigSummary(dir);
  console.log(configSummary);
}

export async function testSyncSubreposFromWorkspace() {
  const dir = '/Users/wuxifei/code/react/start/small-apps-wrapper';
  await syncSubreposFromWorkspace({dir});
}