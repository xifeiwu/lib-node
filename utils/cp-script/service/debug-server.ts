import {getErrorResponse, handleCpCustomization, outputInfo} from '.';
import {getAFreePort} from '../../../net';
import {startHttpDebugServer} from '../../../http';
import {CP} from '../../../types';
import {waitIpcMessageOnce} from '../../../child-process/service';
import {getProcessInfoByInst} from '../../../process';

/**
 * This is a http server target to run on child process to explore feature of child_process
 */
export async function startDebugServer() {
  let ipcMessage = await waitIpcMessageOnce<CP.DebugServerConfig>({maxWaitInSec: 9});
  const config = ipcMessage ?? {};
  /** Make sure port property exist */
  if (config['port'] === undefined) {
    config['port'] = await getAFreePort();
  }
  for (const key of Object.keys(config)) {
    /**
     * if key is 'port' start httpDebugServer, else customize child process behavior
     */
    if (key === 'port') {
      try {
        const serverInfo = await startHttpDebugServer(config, {logRequestHeaderInfo: 'black'});
        const {host, port, origin} = serverInfo;
        delete serverInfo['server'];
        outputInfo(
          {
            serverInfo: {
              host,
              port,
              origin,
              config: serverInfo.config,
            },
            processInfo: getProcessInfoByInst(process),
          },
          {stdout: true, ipc: true}
        );
      } catch (err) {
        outputInfo(getErrorResponse(err), {stdout: true, ipc: true});
      }
    } else {
      await handleCpCustomization(config, key);
    }
  }
}
