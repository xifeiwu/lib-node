/**
 * Mainly used for io testing between main and child process
 */
import {convertToBuffer, fromBuffer} from '../../../index';
import {getChatter, ChatMiddleware, ChatReq, ChatRes} from './external';
import {isNumber, isObject} from '../../../external';

const echoChatMiddleware: ChatMiddleware = async (req: ChatReq) => {
  const {action, payload} = req;
  if (!['echoByStdout', 'echoByStderr', 'echoByIpc'].includes(action as string)) {
    return undefined;
  }
  return {
    status: action,
    body: payload,
  };
};
const echoArgvsMiddleware: ChatMiddleware = async (req: ChatReq) => {
  const {action, payload} = req;
  if (action !== 'echoArgvs') {
    return undefined;
  }
  return {
    status: 'argvs',
    body: process.argv.slice(2),
  };
};
const exitChatMiddleware: ChatMiddleware = async (req: ChatReq) => {
  const {action, payload} = req;
  if (action !== 'exit') {
    return undefined;
  }
  process.exit(isNumber(payload) ? Number(payload) : 0);
  return {
    status: 200,
    body: 'Exited successfully',
  };
};

const notFound: ChatMiddleware = async (req: ChatReq) => {
  return {
    status: 404,
  };
};

export async function startChatServer() {
  const chatter = getChatter({
    middlewares: [echoChatMiddleware, echoArgvsMiddleware, exitChatMiddleware, notFound],
  });
  process.stdin.on('data', async chunk => {
    let req = fromBuffer(chunk, 'json') as ChatReq;
    /** set echoByStdout as default action if only payload is passed */
    if (!isObject(req) || req.action === undefined) {
      req = {
        action: 'echoByStdout',
        payload: req,
      };
    }
    const {action} = req;
    const res = await chatter(req);
    const bufRes = convertToBuffer(res);
    if (action === 'echoByStdout') {
      process.stdout.write(bufRes);
    } else if (action === 'echoByStderr') {
      process.stderr.write(bufRes);
    } else if (action === 'echoByIpc') {
      if (process.connected && process.send) {
        /** IPC messages are JSON-serialized */
        process.send(res);
      } else {
        const res: ChatRes = {status: 500, body: {message: 'IPC channel is not connected'}};
        process.stderr.write(convertToBuffer(res));
      }
    } else {
      /**
       * use stdout by default
       */
      process.stdout.write(bufRes);
    }
  });
  process.stdin.resume();
}

/**
 * Used on client side
 * @param msg
 * @returns
 */
export function echoArgvs() {
  return {
    action: 'echoArgvs',
  };
}
export function echoByStdout(msg: string) {
  return {
    action: 'echoByStdout',
    payload: msg,
  };
}
export function echoByStderr(msg: string) {
  return {
    action: 'echoByStderr',
    payload: msg,
  };
}
export function echoByIpc(msg: string) {
  return {
    action: 'echoByIpc',
    payload: msg,
  };
}
