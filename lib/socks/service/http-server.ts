import Koa from 'koa';
import {SocksStatusOnServerSide} from './types';
import {getConnectStatusInJson} from '.';

const maxStatusLength = 200;

export function exposeStatusByHttp() {
  const connectStatusList: SocksStatusOnServerSide[] = [];
  function pushConnectStatus(status: SocksStatusOnServerSide) {
    if (connectStatusList.length > maxStatusLength) {
      connectStatusList.splice(0, Math.ceil(maxStatusLength / 4));
    }
    connectStatusList.push(status);
  }
  function getConnectStatus() {
    return connectStatusList;
  }

  const middleware: Koa.Middleware = async (ctx, next) => {
    const {url} = ctx;
    if (url === '/api/socks/connections') {
      ctx.type = 'json';
      ctx.body = connectStatusList.map(getConnectStatusInJson);
    } else {
      await next();
    }
  };

  return {pushConnectStatus, getConnectStatus, koaMiddlewareList: [middleware]};
}
