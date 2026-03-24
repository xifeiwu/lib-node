import {isPlainObject} from '../external';

export function convertObjectToCjsExport(
  info: object,
  options?: {
    format?: boolean;
  }
) {
  const {format} = options ?? {};
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value)
        ? JSON.stringify(value, null, format ? 2 : undefined)
        : JSON.stringify(value)
    }`;
    return line;
  });
  return lines.join('\n');
}
