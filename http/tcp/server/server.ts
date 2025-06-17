import {startSocketServer} from '../../../net';
import {httpResponseInfoToBuffer} from '../../service';
import {parseHttpBody} from '../../../lib/http-body-parser';
import {TcpServerConfig} from '../../../types';
import {getHttpIncomingMessage} from '../service/internal';

export async function startHttpDebugServerOnTcp(config?: TcpServerConfig) {
  const {host, port, server, overTls} = await startSocketServer(async socket => {
    const incomingMessage = await getHttpIncomingMessage(socket);
    const data = await parseHttpBody(incomingMessage);
    const requestInfo = {
      ...incomingMessage.headerPartProps,
      data,
    };
    socket.end(
      httpResponseInfoToBuffer(
        {
          statusCode: 200,
          data: requestInfo,
        },
        {role: 'sender'}
      )
    );
  }, config);
  const origin = `${overTls ? 'https' : 'http'}://${host}:${port}`;
  return {host, port, origin, server};
}
