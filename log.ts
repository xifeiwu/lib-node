import util from 'util';
import fs from 'fs';
import path from 'path';
import {isObject, formatDate, isPlainObject} from './fe';

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
  args.forEach(arg => {
    console.log(
      util.inspect(arg, {
        depth: 10,
        colors: true,
      })
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
    })
  );
}

type Colors = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan';
const colorMap: {
  [color in Colors]: {
    start: string;
    end: string;
  };
} = {
  black: {
    start: '\x1B[30m',
    end: '\x1B[39m',
  },
  red: {
    start: '\x1B[31m',
    end: '\x1B[39m',
  },
  green: {
    start: '\x1B[32m',
    end: '\x1B[39m',
  },
  yellow: {
    start: '\x1B[33m',
    end: '\x1B[39m',
  },
  blue: {
    start: '\x1B[34m',
    end: '\x1B[39m',
  },
  magenta: {
    start: '\x1B[35m',
    end: '\x1B[39m',
  },
  cyan: {
    start: '\x1B[36m',
    end: '\x1B[39m',
  },
};

export function logWithColor(color: Colors, ...contentList: Array<object | Buffer | string | number>) {
  for (let content of contentList) {
    if (content === undefined) {
      continue;
    }
    let finalStr = '';
    if (isPlainObject(content)) {
      finalStr = util.inspect(content, {depth: 10, colors: false});
    } else if (Buffer.isBuffer(content)) {
      finalStr = content.toString();
    } else {
      finalStr = String(content);
    }
    const colorInfo = colorMap[color];
    finalStr.split('\n').forEach(oneLine => {
      console.log(`${colorInfo.start}${oneLine}${colorInfo.end}`);
    });
  }
}

export function testLogWithColor() {
  const colors: Colors[] = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan'];
  colors.forEach(color => {
    logWithColor(color, {color, colors});
  });
}
