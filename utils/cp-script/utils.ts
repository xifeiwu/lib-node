import path from 'path';
import {getFileList} from '../../fs';
import {parseBasename} from '../../path';

export {outOnAllChannels} from './service';

export function getFullPathOfCpScript(
  basename: 'chat' | 'debug-server' | 'io-transparent',
  options?: {
    /** try js first if exist */
    tryJsFirst?: boolean;
  }
) {
  const {tryJsFirst} = options ?? {};
  const cpScriptDir = __dirname;
  const scriptList = getFileList(cpScriptDir, {
    fileFilter({basename}) {
      const {bareBasename, extname} = parseBasename(basename);
      return ['.ts', '.js'].includes(extname) && !bareBasename.endsWith('.test');
    },
    maxDepth: 1,
  });
  const preferredScriptList = (tryJsFirst ? ['.js', '.ts'] : ['.ts', '.js']).map(it => `${basename}${it}`);
  const target = scriptList.find(it => preferredScriptList.includes(it));
  if (!target) {
    throw new Error(`Script ${basename} not found`);
  }
  return path.resolve(cpScriptDir, target);
}
