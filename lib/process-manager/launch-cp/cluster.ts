import {getSpawnConfigByScript, waitIpcMessageOnce} from '../service/external';
import {launchCpInDetachedMode} from './detached';
import {launchCpInMonitoredMode} from './monitored';
import type {LaunchCpEntry, LaunchCpInfo} from '../service';

interface ClusterIpcPayload {
  entries: LaunchCpEntry[];
}

export async function launchCluster(entries: LaunchCpEntry[]): Promise<LaunchCpInfo[]> {
  const results: LaunchCpInfo[] = [];
  for (const entry of entries) {
    try {
      const {cpConfig, monitorConfig} = entry;
      if (monitorConfig) {
        results.push(await launchCpInMonitoredMode(cpConfig, monitorConfig));
      } else {
        results.push(await launchCpInDetachedMode(cpConfig));
      }
    } catch (err) {
      console.error(err);
    }
  }
  return results;
}

export async function launchClusterInDetachedMode(
  clusterId: string,
  entries: LaunchCpEntry[]
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
