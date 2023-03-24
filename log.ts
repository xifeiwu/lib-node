import {isObject, formatDate} from './fe';
import util from 'util';

function log2(content: any) {
  if (isObject(content)) {
    console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}]`);
    console.log(
      util.inspect(content, {
        depth: null,
        colors: true,
      })
    );
  } else {
    if (Array.isArray(content)) {
      content = content.join(', ');
    }
    console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}] ${content}`);
  }
}
export function log(content: any): void;
export function log(...args: any[]): void;
export function log() {
  function logOne(content: any) {
    if (isObject(content)) {
      console.log(
        util.inspect(content, {
          showHidden: true,
          depth: null,
          colors: true,
        })
      );
    } else {
      if (Array.isArray(content)) {
        content = content.join(', ');
      }
      console.log(`${content}`);
    }
  }
  const params = [].slice.call(arguments) as any[];
  if (params.length > 1) {
    console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}]`);
    params.forEach(logOne);
  } else if (params.length === 1) {
    log2(params[0]);
  }
}
