import util from 'util';
import fs from 'fs';
import path from 'path';
import {isObject, formatDate} from './fe';

// function log2(content: any) {
//   if (isObject(content)) {
//     console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}]`);
//     console.log(
//       util.inspect(content, {
//         depth: null,
//         colors: true,
//       })
//     );
//   } else {
//     if (Array.isArray(content)) {
//       content = content.join(', ');
//     }
//     console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}] ${content}`);
//   }
// }
// export function log(content: any): void;
// export function log(...args: any[]): void;
// export function log() {
//   function logOne(content: any) {
//     if (isObject(content)) {
//       console.log(
//         util.inspect(content, {
//           showHidden: true,
//           depth: null,
//           colors: true,
//         })
//       );
//     } else {
//       if (Array.isArray(content)) {
//         content = content.join(', ');
//       }
//       console.log(`${content}`);
//     }
//   }
//   const params = [].slice.call(arguments) as any[];
//   if (params.length > 1) {
//     console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}]`);
//     params.forEach(logOne);
//   } else if (params.length === 1) {
//     log2(params[0]);
//   }
// }

export function prettyLog(content: any): void;
export function prettyLog(...args: any[]): void;
export function prettyLog() {
  function logOne(content: any) {
    console.log(`[${formatDate(Date.now(), 'hh:mm:ss.SSS')}]`);
    console.log(
      util.inspect(content, {
        showHidden: true,
        depth: null,
        colors: true,
      })
    );
  }
  const params = [].slice.call(arguments) as any[];
  params.forEach(logOne);
}

export function toConsole(...args: any[]) {
  args.forEach((arg) => {
    console.log(
      util.inspect(arg, {
        depth: 10,
        colors: true,
      }),
    );
  });
}

export function toFile(tag: string, data: string | object) {
  fs.writeFileSync(
    path.resolve(__dirname, `${tag}-${Date.now()}`),
    util.inspect(data, {
      // showHidden: false,
      maxArrayLength: null,
      depth: null,
      colors: false,
    }),
  );
}