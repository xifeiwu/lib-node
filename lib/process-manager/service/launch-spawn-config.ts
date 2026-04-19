import type {SpawnConfig, SpawnScriptOptions} from '../../../types/child_process/common';
import {getSpawnConfigByScript} from './external';
import type {LaunchCpConfig} from './types';

function isScriptPathSpawn(
  raw: NonNullable<LaunchCpConfig['spawnConfig']>
): raw is {scriptPath: string} & SpawnScriptOptions {
  return typeof raw === 'object' && raw !== null && 'scriptPath' in raw;
}

export function resolveLaunchSpawnConfig(raw: NonNullable<LaunchCpConfig['spawnConfig']>): SpawnConfig {
  if (isScriptPathSpawn(raw)) {
    const {scriptPath, ...options} = raw;
    return getSpawnConfigByScript(scriptPath, options);
  }
  return raw;
}
