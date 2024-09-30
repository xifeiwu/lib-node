import {Readable, Writable} from 'stream';
import {NegotiationInfo} from '../service/types/vc1';
import {isNumber, toBuffer} from '../service/external';
import {
  ERRORS,
  bufferToTargeServiceInfo,
  createError,
  targetServiceInfoToBuffer,
  toRequestTargetV5,
} from '../service';
import {decript, encrypt, defaultIvBytes} from './service';
import {BinaryLike} from 'crypto';
import {ECommand, EHandleRequestTargetState, RespondOfRequestTarget} from '../service/types/v5';

/**
 * +----+------+----------+------+----------+
 * |VER | ULEN |  UNAME   | PLEN |  PASSWD  |
 * +----+------+----------+------+----------+
 * | 1  |  1   | 1 to 255 |  1   | 1 to 255 |
 * +----+------+----------+------+----------+
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
 *
 * combine auth and targetServerInfo together
 * +----+-----+------+----------+------+----------+-----+-------+------+----------+----------+
 * |VER | IV  | ULEN |  UNAME   | PLEN |  PASSWD  | CMD |  RSV  | ATYP | DST.ADDR | DST.PORT |
 * +----+-----+------+----------+------+----------+-----+-------+------+----------+----------+
 * | 1  | iv  |  1   | 1 to 255 |  1   | 1 to 255 |  1  | X'00' |  1   | Variable |    2     |
 * +----+-----+------+----------+------+----------+-----+-------+------+----------+----------+
 */
export async function clientSendNegotiationInfo(writer: Writable, info: NegotiationInfo) {
  const {iv, auth, requestTarget} = info;
  const requestTargetV5 = toRequestTargetV5(requestTarget);
  const {username, password} = auth;
  const {command = ECommand.CONNECT, address, port} = requestTargetV5;
  if (!address) {
    throw new Error(`address is blank`);
  }
  if (!isNumber(port)) {
    throw new Error(`port ${port} is not a number`);
  }
  return new Promise<void>(async (res, rej) => {
    const {data} = encrypt(
      toBuffer([
        username.length,
        username,
        password.length,
        password,
        command,
        0,
        targetServiceInfoToBuffer(requestTargetV5),
      ]),
      iv
    );

    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    const buf = toBuffer([5, iv, data]);
    writer.write(buf, err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });
  });
}

export async function serverWaitNegotiationInfo(reader: Readable) {
  reader.resume();
  return new Promise<NegotiationInfo>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      let baseIndex = 0;
      const version = chunk[baseIndex];
      baseIndex += 1;
      const iv = chunk.subarray(baseIndex, baseIndex + defaultIvBytes);
      baseIndex += defaultIvBytes;
      const buffer = decript(chunk.subarray(baseIndex), iv);
      baseIndex = 0;
      const usernameLength = buffer[baseIndex];
      baseIndex += 1;
      const username = buffer.subarray(baseIndex, baseIndex + usernameLength);
      baseIndex += usernameLength;
      const passwordLength = buffer[baseIndex];
      baseIndex += 1;
      const password = buffer.subarray(baseIndex, baseIndex + passwordLength);
      baseIndex += passwordLength;
      const command = buffer[baseIndex];
      baseIndex += 2;

      const {addressType, address, port} = bufferToTargeServiceInfo(buffer.subarray(baseIndex));
      if (address === undefined || port === undefined) {
        return rej(createError('Can not get domain/port info'));
      }
      res({
        iv,
        auth: {
          username: username.toString(),
          password: password.toString(),
        },
        requestTarget: {
          command,
          addressType,
          address,
          port,
        },
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
export async function serverSendNegotiationResponse(
  writer: Writable,
  state: {
    reply: EHandleRequestTargetState;
    address: string;
    port: number;
  },
  iv: BinaryLike
) {
  const {reply, address, port} = state;
  return new Promise<void>((res, rej) => {
    if (!writer.writable) {
      return rej(createError(ERRORS.SocketUnWritable));
    }
    const {data} = encrypt(
      toBuffer([
        5,
        reply,
        0,
        targetServiceInfoToBuffer({
          address,
          port,
        }),
      ]),
      iv
    );
    writer.write(data, err => {
      if (err) {
        rej(err);
      } else {
        res();
      }
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
export async function clientWaitNegotiationResponse(reader: Readable, iv: BinaryLike) {
  reader.resume();
  return new Promise<RespondOfRequestTarget>((res, rej) => {
    reader.once('data', (chunk: Buffer) => {
      reader.pause();
      const buffer = decript(chunk, iv);
      const [version, reply, _reserve] = buffer;
      if (version !== 0x05) {
        return rej(createError(ERRORS.InvalidSocksVersion));
      }
      if (reply !== EHandleRequestTargetState.succeeded) {
        return rej(createError(EHandleRequestTargetState[reply]));
      }
      const {addressType, address, port} = bufferToTargeServiceInfo(buffer.subarray(3));
      res({
        reply,
        addressType,
        address,
        port,
      });
    });
  });
}
