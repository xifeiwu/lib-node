import {getSpawnConfigByScript, spawnScriptAndTryIpc} from '../../child-process/spawn';
import {logColorful} from '../../log';
import {echoArgvs, echoByIpc, echoByStderr, echoByStdout} from './service/chat';
import {convertToBuffer, fromBuffer} from '../../transform';
import {getFullPathOfCpScript} from '.';
import {ChatReq, ChatRes} from './service/external';
import { exec } from 'child_process';

/**
 * Summary:
 * 1. When use inherit stdio, process.stdin.push will not trigger data event on child process.
 * 2. childProcess.stdin.write will conbine two write action into one, so do the communication in on chat
 * way which is implemented in function oneChat
 */
export async function run() {
  const scriptPath = getFullPathOfCpScript('chat', {tryJsFirst: true});
  /** Way1: Start child process by exec */
  const {command, args} = getSpawnConfigByScript(scriptPath);
  const wholeScript = [command, ...args].join(' ');
  const childProcess = exec(wholeScript);

  /** Way2: Start child process by spawn */
  // const {childProcess, wholeScript} = await spawnScriptAndTryIpc(scriptPath, {
  //   spawnOptions: {
  //     stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
  //   },
  // });
  logColorful({}, childProcess.pid, wholeScript);
  childProcess.on('error', err => {
    logColorful({color: 'yellow'}, 'error', err.message);
  });
  childProcess.on('close', code => {
    logColorful({color: 'magenta'}, 'close', code);
  });
  childProcess.on('disconnect', () => {
    logColorful({color: 'cyan'}, 'disconnect');
  });
  childProcess.on('exit', code => {
    logColorful({color: 'magenta'}, 'exit', code);
  });
  // childProcess.stdout.on('data', chunk => {
  //   const result = fromBuffer(chunk as Buffer, 'json');
  //   logColorful({color: 'black'}, result);
  // });
  /**
   * take case about error info by listen stderr event
   */
  childProcess.stderr.on('data', chunk => {
    const result = fromBuffer(chunk as Buffer, 'json');
    logColorful({color: 'black'}, result);
  });

  async function oneChat(req: ChatReq) {
    childProcess.stdin.write(convertToBuffer(req));
    return await new Promise<ChatRes>(res => {
      const handleChunk = (chunk: Buffer) => {
        const result = fromBuffer(chunk, 'json') as ChatRes;
        if (result.status !== undefined) {
          res(result);
        } else {
          logColorful({color: 'yellow'}, 'ignored chunk', chunk.toString());
        }
      };
      childProcess.once('message', chunk => {
        handleChunk(chunk as Buffer);
      });
      childProcess.stdout.once('data', chunk => {
        handleChunk(chunk as Buffer);
      });
      childProcess.stderr.once('data', chunk => {
        handleChunk(chunk as Buffer);
      });
    });
  }
  const reqList = [echoArgvs(), echoByStdout('through stdout'), echoByStderr('through stderr'), echoByIpc('through ipc')];
  for (const req of reqList) {
    const res = await oneChat(req);
    logColorful({color: 'green'}, res);
  }
  process.stdin.resume();
  process.stdin.on('data', async (chunk: Buffer | string) => {
    const res = await oneChat({action: 'echoByIpc', payload: fromBuffer(chunk, 'json')});
    logColorful({color: 'green'}, res);
  });
}
