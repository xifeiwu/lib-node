import {logColorful} from '../../log';
import {toReadable} from '../../stream';
import {DebugServerPathname, startHttpDebugServer} from '../server';
import {requestAndGetResponseInfo} from './sender';

export async function testRequestAndGetResponseInfo() {
  {
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      method: 'post',
      origin: 'http://elif.site',
      pathname: '/api/debug/echo',
      data: toReadable({
        a: 1,
        b: true,
      }),
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
  }
}

export async function testEmptyArray() {
  {
    const {origin, server} = await startHttpDebugServer();
    const {requestOptions, responseInfo, request} = await requestAndGetResponseInfo({
      method: 'delete',
      origin,
      pathname: DebugServerPathname.echo,
      // method: 'delete',
      // origin: 'http://127.0.0.1:7778',
      // pathname: '/v1.0/users',
      // headers: {
      //   cookie: '_turtle_pulse_session_id=ae18b64418290abf59866b172945e2c4',
      // },
      // data: toReadable({
      //   a: 1,
      //   b: true,
      // }),
      // data: [],
      data: [
        {
          customer: {
            id: 1960183749,
          },
          users: [
            {
              email: '2020@88.com',
              firstName: 'xf',
              lastName: 'wu',
              roleId: 1,
              canCreateActivation: true,
              canEditPrecisionPolicy: false,
              mdsEnabled: true,
              ciEnabled: false,
              ciCreateSegmentPermission: false,
              ciExportPermission: true,
              ciShareSegmentCreatedByMePermission: false,
              ciSegmentAdminPermission: false,
              hidden: true,
            },
          ],
        },
      ],
    });
    const headers = request.getHeaders();
    logColorful({}, headers);
    logColorful({}, requestOptions);
    logColorful({}, responseInfo);
    server.close();
  }
}
