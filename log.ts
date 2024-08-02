import util from 'util';
import path from 'path';
import {isObject, formatDate, isPlainObject} from './external';
import {writeFileSync} from './fs';
import {CanConvertToBuffer, ColorStyle, LogColors, LoggableContent} from './types';

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

/** inspect with more commonly used config */
export function inspect(arg: any) {
  return util.inspect(arg, {
    maxArrayLength: null,
    depth: 10,
    colors: true,
  });
}
export function toConsole(...args: any[]) {
  args.forEach(arg => {
    console.log(
      util.inspect(arg, {
        maxArrayLength: null,
        depth: 10,
        colors: true,
      })
    );
  });
}

export function toFile(data: string | object, config: {dir: string; fileName: string}) {
  const {dir, fileName} = config;
  const fullPath = path.resolve(dir, `${Date.now()}-${fileName}`);
  writeFileSync(
    fullPath,
    util.inspect(data, {
      // showHidden: false,
      maxArrayLength: null,
      depth: null,
      colors: false,
    })
  );
  return fullPath;
}

const colorMap: {
  [color in LogColors]: {
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

export function coloringContent(colorStyle: ColorStyle, content: LoggableContent): string {
  const {color = 'black'} = colorStyle;
  let finalStr = '';
  if (isPlainObject(content) || Array.isArray(content)) {
    finalStr = util.inspect(content, {depth: 10, colors: false});
  } else if (Buffer.isBuffer(content)) {
    finalStr = content.toString();
  } else {
    finalStr = String(content);
  }
  const colorInfo = colorMap[color];
  return `${colorInfo.start}${finalStr}${colorInfo.end}`;
}
export function logColorful(
  colorStyle: ColorStyle,
  ...contentList: Array<object | Buffer | string | number>
) {
  for (const content of contentList) {
    const finalStr = coloringContent(colorStyle, content);
    console.log(finalStr);
  }
}

/**
 * @deprecated will be replaced by colorfulLog
 * @param color
 * @param contentList
 */
export function logWithColor(color: LogColors, ...contentList: Array<object | Buffer | string | number>) {
  for (const content of contentList) {
    if (content === undefined) {
      continue;
    }
    let finalStr = '';
    if (isPlainObject(content) || Array.isArray(content)) {
      finalStr = util.inspect(content, {depth: 10, colors: false});
    } else if (Buffer.isBuffer(content)) {
      finalStr = content.toString();
    } else {
      finalStr = String(content);
    }
    const colorInfo = colorMap[color];
    // finalStr.split('\n').forEach(oneLine => {
    console.log(`${colorInfo.start}${finalStr}${colorInfo.end}`);
    // });
  }
}
