import {isPlainObject} from '../external';

export function convertObjectToCjsExport(info: object) {
  const lines = Object.entries(info).map(([key, value]) => {
    const line = `module.exports.${key} = ${
      isPlainObject(value) || Array.isArray(value) ? JSON.stringify(value) : value
    }`;
    return line;
  });
  return lines.join('\n');
}
