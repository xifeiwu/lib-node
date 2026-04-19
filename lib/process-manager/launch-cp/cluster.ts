import {getSpawnConfigByScript, waitIpcMessageOnce} from '../service/external';
import {launchCpInDetachedMode} from './detached';
import {launchCpInMonitoredMode} from './monitored';
import type {LaunchCpConfig, LaunchCpInfo} from '../service';

interface ClusterIpcPayload {
  entries: LaunchCpConfig[];
}

export async function launchCluster(entries: LaunchCpConfig[]): Promise<LaunchCpInfo[]> {
  const results: LaunchCpInfo[] = [];
  for (const entry of entries) {
    try {
      if (entry.monitorConfig) {
        results.push(await launchCpInMonitoredMode(entry));
      } else {
        results.push(await launchCpInDetachedMode(entry));
      }
    } catch (err) {
      console.error(err);
    }
  }
  return results;
}

export async function launchClusterInDetachedMode(
  clusterId: string,
  entries: LaunchCpConfig[]
): Promise<LaunchCpInfo> {
  return launchCpInDetachedMode({
    id: clusterId,
    spawnConfig: getSpawnConfigByScript(__filename, {
      infoToCp: {entries} as ClusterIpcPayload,
      maxWaitCpResInSec: 60,
    }),
  });
}

// Script entry point: runs when this file is spawned as a child process
if (require.main === module) {
  (async () => {
    const payload = await waitIpcMessageOnce<ClusterIpcPayload>();
    if (!payload?.entries) {
      process.exit(1);
    }
    const results = await launchCluster(payload.entries);
    process.send?.(results);
  })();
}
