import {getErrorResponse, handleCpCustomization, outOnAllChannels} from './base';
import {getAFreePort} from '../../../net';
import {startHttpDebugServer} from '../../../http';
import {CP} from '../../../types';
import {waitIpcMessageOnce} from '../../../child-process/service';
import {getProcessInfoByInst} from '../../../process';

/**
 * This is a http server target to run on child process to explore feature of child_process
 */
export async function startDebugServer() {
  let ipcMessage: CP.DebugServerConfig = await waitIpcMessageOnce<CP.DebugServerConfig>({maxWaitInSec: 9});
  const config = ipcMessage ?? {};
  /** Make sure port property exist */
  if (config['port'] === undefined) {
    config['port'] = await getAFreePort();
  }
  for (const key of Object.keys(config)) {
    if (key === 'port') {
      try {
        const serverInfo = await startHttpDebugServer(config, {logRequestHeaderInfo: 'black'});
        const {host, port, origin} = serverInfo;
        delete serverInfo['server'];
        outOnAllChannels({
          serverInfo: {
            host,
            port,
            origin,
            config: serverInfo.config,
          },
          processInfo: getProcessInfoByInst(process),
        });
      } catch (err) {
        outOnAllChannels(getErrorResponse(err));
      }
    } else {
      await handleCpCustomization(config, key);
    }
  }
}
