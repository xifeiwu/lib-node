import {startSocketServer} from '../../../net';
import {getDataFromReadable} from '../../../stream';
import {getHttpIncomingMessage} from '../utils';
import {httpResponseInfoToBuffer} from '../../service';
import {parseHttpBody} from '../../../lib/http-body-parser';

export async function startHttpDebugServerOnTcp() {
  const {host, port, server} = await startSocketServer(async socket => {
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
  });
  const origin = `http://${host}:${port}`;
  return {host, port, origin, server};
}
