import {Readable, Writable} from 'stream';
import {
  SOCKS_DEFAULT_COMMAND,
  ERRORS,
  bufferToTargeServiceInfo,
  createError,
  listenTimeOut,
  targetServiceInfoToBuffer,
} from '..';
import {EMethod, EHandleRequestTargetState, RequestTargetV5, RequestTargetResponseV5} from '../types/v5';
import {isNumber, toBuffer} from '../service/external';
import {PROTOCOL_BYTE} from './service';

/**
 * +----+----------+----------+
 * |VER | NMETHODS | METHODS  |
 * +----+----------+----------+
 * | 1  |    1     | 1 to 255 |
 * +----+----------+----------+
 * o  X'00' NO AUTHENTICATION REQUIRED
 * o  X'01' GSSAPI
 * o  X'02' USERNAME/PASSWORD
 * o  X'03' to X'7F' IANA ASSIGNED
 * o  X'80' to X'FE' RESERVED FOR PRIVATE METHODS
 * o  X'FF' NO ACCEPTABLE METHODS
 */
export async function clientSendMethod(writer: Writable, methods: EMethod[]) {
  return new Promise<void>((res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(Buffer.from([PROTOCOL_BYTE, methods.length, ...methods]), err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}

export async function serverWaitMethod(reader: Readable, supportedMethods: EMethod[]) {
  reader.resume();
  return new Promise<EMethod>((res, rej) => {
    const timeoutTag = listenTimeOut(rej, {errMessage: 'serverWaitMethod'});
    reader.once('data', (chunk: Buffer) => {
      clearTimeout(timeoutTag);
      reader.pause();
      const [version, count, ...methods] = chunk;
      if (version !== PROTOCOL_BYTE) {
        return rej(createError(ERRORS.InvalidSocksVersion, chunk));
      }
      if (count !== methods.length) {
        return rej(createError(ERRORS.MethodCountNotCorrect, chunk));
      }
      const method = methods.find(it => supportedMethods.includes(it));
      if (method !== undefined) {
        res(method);
      } else {
        return rej(createError(ERRORS.invalid_methods, chunk));
      }
    });
  });
}
/**
 * +----+--------+
 * |VER | METHOD |
 * +----+--------+
 * | 1  |   1    |
 * +----+--------+
 * o  X'00' NO AUTHENTICATION REQUIRED
 * o  X'01' GSSAPI
 * o  X'02' USERNAME/PASSWORD
 * o  X'03' to X'7F' IANA ASSIGNED
 * o  X'80' to X'FE' RESERVED FOR PRIVATE METHODS
 * o  X'FF' NO ACCEPTABLE METHODS
 */
export async function serverReplyMethod(writer: Writable, method: EMethod) {
  return new Promise<void>((res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(Buffer.from([PROTOCOL_BYTE, method]), err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}

export async function clientWaitMethodReplied(reader: Readable, methods: EMethod[]) {
  reader.resume();
  return new Promise<EMethod>((res, rej) => {
    const timeoutTag = listenTimeOut(rej, {errMessage: 'clientWaitMethodReplied'});
    reader.once('data', (chunk: Buffer) => {
      clearTimeout(timeoutTag);
      reader.pause();
      // const version = chunk[0];
      if (chunk.byteLength > 2) {
        return rej(createError(ERRORS.InvalidSchemaFormat, chunk));
      }
      const [version, method] = chunk;
      if (version !== PROTOCOL_BYTE) {
        return rej(createError(ERRORS.InvalidSocksVersion, chunk));
      }
      if (method === EMethod.NoAcceptable) {
        return rej(createError(ERRORS.INVALID_METHOD, chunk));
      } else if (methods.includes(method)) {
        return res(method);
      } else {
        return rej(createError(`${ERRORS.INVALID_METHOD}: ${method}`, chunk));
      }
    });
  });
}
/**
 * +----+------+----------+------+----------+
 * |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
 * +----+------+----------+------+----------+
 * | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
 * +----+------+----------+------+----------+
 */
export async function clientSendUserPass(
  writer: Writable,
  info: {
    username: string;
    password: string;
  }
) {
  const {username, password} = info;
  const usernameLength = Buffer.byteLength(username);
  const passwordLength = Buffer.byteLength(password);
  if (usernameLength > 255 || passwordLength > 255) {
    throw createError(ERRORS.MORE_THAN_255_BYTES);
  }
  return new Promise<void>(async (res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(toBuffer([1, usernameLength, username, passwordLength, password]), err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}

export async function serverWaitUserPass(reader: Readable) {
  return new Promise<{
    username: Buffer;
    password: Buffer;
  }>((res, rej) => {
    reader.resume();
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      const _version = chunk[0];
      const usernameLength = chunk[1];
      let baseIndex = 2;
      const username = chunk.subarray(baseIndex, baseIndex + usernameLength);
      baseIndex += usernameLength;
      const passwordLength = chunk[baseIndex];
      baseIndex += 1;
      const password = chunk.subarray(baseIndex, baseIndex + passwordLength);
      res({
        username,
        password,
      });
    });
  });
}
/**
 * +----+--------+
 * |VER | STATUS |
 * +----+--------+
 * | 1  |   1    |
 * +----+--------+
 * A STATUS field of X'00' indicates success.
 * If the server returns a `failure' (STATUS value other than X'00') status, it MUST close the connection.
 */
export async function serverReplyUserPassAuthResult(writer: Writable, success: boolean) {
  return new Promise<void>((res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(Buffer.from([1, success ? 0 : 1]), err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}

export async function clientWaitUserPassAuthResultReplied(reader: Readable) {
  reader.resume();
  return new Promise<void>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      // const version = chunk[0];
      if (chunk.byteLength > 2) {
        return rej(createError(ERRORS.InvalidSchemaFormat, chunk));
      }
      const [_version, status] = chunk;
      // if (version !== 0x01) {
      //   return rej(createError(ERRORS.InvalidSocksVersion));
      // }
      if (status !== 0x00) {
        return rej(createError(ERRORS.authUserPassFail, chunk));
      }
      res();
    });
  });
}

/**
 * +----+-----+-------+------+----------+----------+
 * |VER | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
 * +----+-----+-------+------+----------+----------+
 * | 1  |  1  | X'00' |  1   | Variable |    2     |
 * +----+-----+-------+------+----------+----------+
 * Where:
 * o  VER    protocol version: X'05'
 * o  CMD
 *     o  CONNECT X'01'
 *     o  BIND X'02'
 *     o  UDP ASSOCIATE X'03'
 *     o  RSV    RESERVED
 * o  ATYP   address type of following address
 * o  IP V4 address: X'01'
 *     o  DOMAINNAME: X'03'
 *     o  IP V6 address: X'04'
 *     o  DST.ADDR       desired destination address
 * o  DST.PORT desired destination port in network octet order
 */
export async function clientSendRequestTarget(writer: Writable, info: RequestTargetV5) {
  const {command = SOCKS_DEFAULT_COMMAND, address, port} = info;
  if (!address) {
    throw new Error(`address is blank`);
  }
  if (!isNumber(port)) {
    throw new Error(`port ${port} is not a number`);
  }
  return new Promise<void>(async (res, rej) => {
    const buffer = toBuffer([PROTOCOL_BYTE, command, 0, targetServiceInfoToBuffer(info)]);
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(buffer, err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}
export async function serverWaitRequestTarget(reader: Readable) {
  reader.resume();
  return new Promise<RequestTargetV5>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      const [version, command, _reserve] = chunk;
      if (version !== PROTOCOL_BYTE) {
        return rej(createError(ERRORS.InvalidSocksVersion));
      }
      const {addressType, address, port} = bufferToTargeServiceInfo(chunk.subarray(3));
      if (address === undefined || port === undefined) {
        return rej(createError('Can not get domain/port info', chunk));
      }
      res({
        command,
        addressType,
        address,
        port,
      });
    });
  });
}

/**
 * +----+-----+-------+------+----------+----------+
 * |VER | REP |  RSV  | ATYP | BND.ADDR | BND.PORT |
 * +----+-----+-------+------+----------+----------+
 * | 1  |  1  | X'00' |  1   | Variable |    2     |
 * +----+-----+-------+------+----------+----------+
 * Where:
 * o  VER    protocol version: X'05'
 * o  REP    Reply field:
 * o  X'00' succeeded
 *     o  X'01' general SOCKS server failure
 *     o  X'02' connection not allowed by ruleset
 *     o  X'03' Network unreachable
 *     o  X'04' Host unreachable
 *     o  X'05' Connection refused
 *     o  X'06' TTL expired
 *     o  X'07' Command not supported
 *     o  X'08' Address type not supported
 *     o  X'09' to X'FF' unassigned
 *     o  RSV    RESERVED
 * o  ATYP   address type of following address
 */
export async function serverSendRequestTargetResponse(writer: Writable, respond: RequestTargetResponseV5) {
  const {reply, address, port} = respond;
  return new Promise<boolean>((res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    writer.write(
      toBuffer([
        PROTOCOL_BYTE,
        reply,
        0,
        targetServiceInfoToBuffer({
          address,
          port,
        }),
      ]),
      err => {
        if (err) {
          rej(err);
        } else {
          res(true);
        }
      }
    );
  });
}
export async function clientWaitRequestTargetResponse(reader: Readable) {
  reader.resume();
  return new Promise<RequestTargetResponseV5>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      const [version, reply, _reserve] = chunk;
      if (version !== PROTOCOL_BYTE) {
        return rej(createError(ERRORS.InvalidSocksVersion, chunk));
      }
      if (reply !== EHandleRequestTargetState.succeeded) {
        return rej(createError(EHandleRequestTargetState[reply], chunk));
      }
      const {addressType, address, port} = bufferToTargeServiceInfo(chunk.subarray(3));
      res({
        reply,
        addressType,
        address,
        port,
      });
    });
  });
}
